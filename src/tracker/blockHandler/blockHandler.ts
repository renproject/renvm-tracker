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
    getAssetPrice,
    getLocked,
    MintOrBurn,
    parseSelector,
    setFees,
    setLocked,
    updateAssetPrice,
} from "./snapshotUtils";
import { DEBUG } from "../../common/environmentVariables";
import {
    BlockHandlerInterface,
    BlockState,
    CommonBlock,
} from "../blockWatcher/events";
import { applyPrice, applyPriceWithChain } from "../priceFetcher/PriceFetcher";
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
        block: CommonBlock,
        transactionIn: ResponseQueryTx
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
            snapshot = await updateAssetPrice(snapshot, asset, this.network);
            const assetPrice = getAssetPrice(snapshot, asset);

            const amountWithPrice = applyPriceWithChain(
                chain,
                asset,
                amount,
                assetPrice
            );

            snapshot = await addVolume(snapshot, amountWithPrice, assetPrice);
            snapshot = await addLocked(snapshot, amountWithPrice, assetPrice);

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

    blockStateHandler = async (
        snapshot: Snapshot,
        block: CommonBlock,
        blockState: BlockState
    ) => {
        const logPrefix = yellow(`[${this.network}][block #${block.height}]`);

        for (const asset of Object.keys(blockState)) {
            const assetState = blockState[asset];
            snapshot = await updateAssetPrice(snapshot, asset, this.network);
            const assetPrice = getAssetPrice(snapshot, asset);

            // Locked amounts.
            for (const { amount, chain } of assetState.minted) {
                const latestLockedWithPrice = applyPriceWithChain(
                    chain,
                    asset,
                    amount.toFixed(),
                    assetPrice
                );
                const existingLocked = await getLocked(snapshot, chain, asset);
                snapshot = await setLocked(snapshot, latestLockedWithPrice);

                // Check if the amount itself (not just the prices) changed.
                if (
                    existingLocked &&
                    existingLocked.amount !== latestLockedWithPrice.amount
                ) {
                    console.log(
                        `${logPrefix} Updating ${asset} on ${chain} locked amount from ${existingLocked.amount} to ${latestLockedWithPrice.amount} ($${latestLockedWithPrice.amountInUsd}).`
                    );
                }
            }

            // Fees
            {
                // Sum up epoch fees.
                const epochSum = assetState.fees.epochs.reduce(
                    (sum, epoch) => sum.plus(epoch.amount),
                    new BigNumber(0)
                );

                const feesTotal = epochSum.plus(assetState.fees.unassigned);

                const feesTotalWithPrice = applyPrice(
                    asset,
                    feesTotal.toFixed(),
                    assetPrice
                );

                snapshot = await setFees(snapshot, feesTotalWithPrice);
            }
        }
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
                    block,
                    transaction
                );
            }

            if (blockState) {
                try {
                    await this.blockStateHandler(snapshot, block, blockState);
                } catch (error) {
                    console.error(error);
                }
            }

            // Save snapshot and renVM database entries atomically.
            renVM.syncedBlock = block.height;
            await this.connection.manager.save([renVM, snapshot]);
        }
    };
}
