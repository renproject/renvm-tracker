import { TxStatus } from "@renproject/interfaces";
import {
    unmarshalMintTx,
    unmarshalBurnTx,
} from "@renproject/rpc/build/main/v2";
import { ResponseQueryTx } from "@renproject/rpc/build/main/v2/methods";
import BigNumber from "bignumber.js";
import { blue, blueBright, cyan, green, magenta, red, yellow } from "chalk";
import { RenVM } from "../../database/models";
import { Connection } from "typeorm";
import { Snapshot, getSnapshot } from "../../database/models/Snapshot";
import {
    addLocked,
    addVolume,
    getTokenPrice,
    MintOrBurn,
    parseSelector,
    setLocked,
    updateTokenPrice,
} from "./snapshotUtils";
import { DEBUG } from "../../common/environmentVariables";
import {
    BlockHandlerInterface,
    BlockState,
    CommonBlock,
} from "../blockWatcher/events";
import { applyPrice } from "../priceFetcher/PriceFetcher";
import { RenNetwork } from "../../networks";

const colorizeChain = (chain: string): string => {
    const color =
        chain === "Ethereum"
            ? blue
            : chain === "Solana"
            ? magenta
            : chain === "BinanceSmartChain"
            ? yellow
            : chain === "Fantom"
            ? blueBright
            : chain === "Polygon"
            ? magenta
            : chain === "Avalanche"
            ? red
            : cyan;
    return color(chain);
};

export class BlockHandler {
    network: RenNetwork;
    connection: Connection;

    constructor(network: RenNetwork, connection: Connection) {
        this.network = network;
        this.connection = connection;
    }

    transactionHandler = async (
        snapshot: Snapshot,
        transactionIn: ResponseQueryTx,
        block: CommonBlock,
        blockState?: BlockState
    ) => {
        const transaction = transactionIn["tx"];

        const selector =
            (transaction as any).to ||
            (transaction as ResponseQueryTx["tx"]).selector;

        let asset: string;
        let chain: string;
        let mintOrBurn: MintOrBurn;
        try {
            ({ chain, asset, mintOrBurn } = parseSelector(selector));
        } catch (error) {
            if (DEBUG) {
                console.warn(
                    `
                    ${yellow(
                        `[${this.network}][block #${block.height}]`
                    )} ${red(`Unrecognized selector format ${selector}:`)}
                    `,
                    error
                );
            }
            return snapshot;
        }

        const logPrefix = yellow(`[${this.network}][block #${block.height}]`);

        const latestLocked =
            blockState &&
            blockState[asset].minted.filter(
                (amount) => amount.chain === chain
            )[0]?.amount;

        let amount: string | undefined;
        if (mintOrBurn === MintOrBurn.MINT) {
            let tx = unmarshalMintTx({
                tx: transaction as any,
                txStatus: TxStatus.TxStatusDone,
            });

            if (
                tx.out &&
                (tx.out.revert === undefined || (tx.out.revert as any) === "")
            ) {
                amount = new BigNumber((tx.out as any).amount).toFixed();
            }
        } else if (mintOrBurn === MintOrBurn.BURN) {
            let tx = unmarshalBurnTx({
                tx: transaction as any, // as ResponseQueryBurnTx["tx"],
                txStatus: TxStatus.TxStatusDone,
            });

            if (
                tx.out &&
                ((tx.out as any).revert === undefined ||
                    (tx.out as any).revert === "")
            ) {
                amount = new BigNumber(tx.in.amount).negated().toFixed();
            }
        } else {
            console.error(
                `${logPrefix} ${red(
                    `Skipping transaction with selector ${selector}.`
                )}`
            );
        }

        if (amount) {
            snapshot = await updateTokenPrice(snapshot, asset, this.network);
            const tokenPrice = getTokenPrice(snapshot, asset);

            const amountWithPrice = applyPrice(
                chain,
                asset,
                amount,
                tokenPrice
            );

            snapshot = await addVolume(snapshot, amountWithPrice, tokenPrice);

            if (latestLocked) {
                const latestLockedWithPrice = applyPrice(
                    chain,
                    asset,
                    latestLocked.toFixed(),
                    tokenPrice
                );
                console.log(
                    `${logPrefix} Updating ${asset} on ${chain} locked amount to ${latestLockedWithPrice.amount} ($${latestLockedWithPrice.amountInUsd}).`
                );
                snapshot = await setLocked(snapshot, latestLockedWithPrice);
            } else {
                snapshot = await addLocked(
                    snapshot,
                    amountWithPrice,
                    tokenPrice
                );
            }

            const color = mintOrBurn === MintOrBurn.MINT ? green : red;
            let amountString = new BigNumber(amountWithPrice.amount)
                .abs()
                .div(new BigNumber(10).exponentiatedBy(8))
                .toFixed();
            if (amountString.length < 15) {
                amountString =
                    " ".repeat(15 - amountString.length) + amountString;
            }
            console.log(
                `${logPrefix} ${color(
                    `${mintOrBurn} ${amountString} ${asset}`
                )} from ${colorizeChain(chain)}`
            );
        }

        return snapshot;
    };

    blockHandler: BlockHandlerInterface = async (
        renVM: RenVM,
        block: CommonBlock,
        blockState?: BlockState
    ) => {
        if (block.transactions.length > 0) {
            // Update snapshot for each transaction.
            let snapshot = await getSnapshot(block.timestamp);
            for (let transaction of block.transactions) {
                snapshot = await this.transactionHandler(
                    snapshot,
                    transaction,
                    block,
                    blockState
                );
            }

            // Save snapshot and renVM database entries atomically.
            renVM.syncedBlock = block.height;
            await this.connection.manager.save([renVM, snapshot]);
        }
    };
}
