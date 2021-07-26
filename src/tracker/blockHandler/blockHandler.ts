import { TxStatus } from "@renproject/interfaces";
import {
    ResponseQueryMintTx,
    unmarshalBurnTx,
} from "@renproject/rpc/build/main/v1";
import { unmarshalMintTx } from "@renproject/rpc/build/main/v2";
import { ResponseQueryTx } from "@renproject/rpc/build/main/v2/methods";
import BigNumber from "bignumber.js";
import { cyan, green, magenta, red, yellow } from "chalk";
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
            (transaction as any as ResponseQueryMintTx["tx"]).to ||
            (transaction as ResponseQueryTx["tx"]).selector;

        let asset: string;
        let token: string;
        let chain: string;
        let mintOrBurn: MintOrBurn;
        try {
            ({ chain, asset, token, mintOrBurn } = parseSelector(selector));
        } catch (error) {
            if (DEBUG) {
                console.warn(
                    `[${yellow(this.network)}] ${red(
                        `Unrecognized selector format ${selector}`
                    )}`
                );
            }
            return snapshot;
        }

        const latestLocked =
            blockState &&
            blockState[asset].minted.filter(
                (amount) => amount.chain === chain
            )[0]?.amount;

        let amount: string | undefined;
        if (mintOrBurn === MintOrBurn.MINT) {
            let tx = unmarshalMintTx({
                tx: transaction as any, // as ResponseQueryMintTx["tx"],
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
                `[${yellow(this.network)}] ${red(
                    `Unrecognized selector format ${selector}`
                )}`
            );
        }

        if (amount) {
            snapshot = await updateTokenPrice(snapshot, asset);
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
                    `[${yellow(
                        this.network
                    )}] Updating ${token} locked amount to ${
                        latestLockedWithPrice.amount
                    } ($${latestLockedWithPrice.amountInUsd}).`
                );
                snapshot = await setLocked(snapshot, latestLockedWithPrice);
            } else {
                snapshot = await addLocked(
                    snapshot,
                    amountWithPrice,
                    tokenPrice
                );
            }

            console.log(
                `[${yellow(this.network)}] [${
                    token === "BTC/Ethereum" ? yellow(token) : cyan(token)
                }][${block.height}] ${
                    mintOrBurn === MintOrBurn.MINT
                        ? green(mintOrBurn)
                        : red(mintOrBurn)
                } ${new BigNumber(amountWithPrice.amount)
                    .div(new BigNumber(10).exponentiatedBy(8))
                    .toFixed()} ${magenta(asset)}`
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
