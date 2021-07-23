import { TxStatus } from "@renproject/interfaces";
import {
    ResponseQueryMintTx,
    unmarshalBurnTx,
} from "@renproject/rpc/build/main/v1";
import { unmarshalMintTx } from "@renproject/rpc/build/main/v2";
import { ResponseQueryTx } from "@renproject/rpc/build/main/v2/methods";
import BigNumber from "bignumber.js";
import { cyan, green, magenta, red, yellow } from "chalk";
import { RenVMInstance, RenVMInstances } from "../../database/models";
import { TokenAmount } from "../../database/models/amounts";
import { Connection } from "typeorm";
import {
    addLocked,
    addVolume,
    getTimeBlock,
    MintOrBurn,
    parseSelector,
    setLocked,
    subtractLocked,
    TimeBlock,
    updateTokenPrice,
} from "../../database/models/TimeBlock";
import { DEBUG } from "../../util/environmentVariables";
import {
    BlockHandlerInterface,
    BlockState,
    CommonBlock,
} from "../blockWatcher/events";
import { applyPrice } from "../priceFetcher/PriceFetcher";

export class BlockHandler {
    instance: RenVMInstances;
    connection: Connection;

    constructor(instance: RenVMInstances, connection: Connection) {
        this.instance = instance;
        this.connection = connection;
    }

    transactionHandler = async (
        timeBlock: TimeBlock,
        transactionIn: ResponseQueryTx,
        block: CommonBlock,
        blockState?: BlockState
    ) => {
        const transaction = transactionIn["tx"];

        const selector =
            (transaction as any as ResponseQueryMintTx["tx"]).to ||
            (transaction as ResponseQueryTx["tx"]).selector;

        let parsed: {
            asset: string;
            token: string;
            chain: string;
            mintOrBurn: MintOrBurn;
        };
        try {
            parsed = parseSelector(selector);
        } catch (error) {
            if (DEBUG) {
                console.warn(`Unrecognized selector format ${selector}`);
            }
            return timeBlock;
        }
        const { asset, token, mintOrBurn } = parsed;

        const assetLockedBefore = timeBlock.lockedJSON.get(token)?.amount;

        const latestLocked =
            blockState &&
            blockState[asset].minted.filter(
                (amount) => amount.chain === parsed.chain
            )[0]?.amount;

        let amountWithPrice: TokenAmount | undefined;
        if (mintOrBurn === MintOrBurn.MINT) {
            // Mint

            let tx = unmarshalMintTx({
                tx: transaction as any, // as ResponseQueryMintTx["tx"],
                txStatus: TxStatus.TxStatusDone,
            });

            // If the transaction doesn't have an `out` value, it
            // may have been reverted.
            if (
                tx.out &&
                (tx.out.revert === undefined || (tx.out.revert as any) === "")
            ) {
                const amount = (tx.out as any).amount;

                timeBlock = await updateTokenPrice(
                    timeBlock,
                    asset,
                    block.timestamp
                );

                const tokenPrice = timeBlock.pricesJSON.get(asset, undefined);
                amountWithPrice = applyPrice(new BigNumber(amount), tokenPrice);

                timeBlock = await addVolume(
                    timeBlock,
                    token,
                    amountWithPrice,
                    tokenPrice
                );

                if (latestLocked) {
                    const latestLockedWithPrice = applyPrice(
                        new BigNumber(latestLocked),
                        tokenPrice
                    );
                    console.log(
                        `!!! Updating ${token} locked amount to ${latestLockedWithPrice.amount.toFixed()} ($${latestLockedWithPrice.amountInUsd.toFixed()}) !!!`
                    );
                    timeBlock = await setLocked(
                        timeBlock,
                        token,
                        latestLockedWithPrice
                    );
                } else {
                    timeBlock = await addLocked(
                        timeBlock,
                        token,
                        amountWithPrice,
                        tokenPrice
                    );
                }

                // saveQueue.push(
                //     new Transaction(
                //         token,
                //         amount,
                //         renvmState.network,
                //         this.instance,
                //         timestamp.unix(),
                //         block.height
                //     )
                // );
            }
        } else if (mintOrBurn === MintOrBurn.BURN) {
            // Burn

            let tx = unmarshalBurnTx({
                tx: transaction as any, // as ResponseQueryBurnTx["tx"],
                txStatus: TxStatus.TxStatusDone,
            });

            // Check that the transaction wasn't reverted.
            if (
                tx.out &&
                ((tx.out as any).revert === undefined ||
                    (tx.out as any).revert === "")
            ) {
                const amount = tx.in.amount;

                timeBlock = await updateTokenPrice(
                    timeBlock,
                    asset,
                    block.timestamp
                );

                const tokenPrice = timeBlock.pricesJSON.get(asset, undefined);
                amountWithPrice = applyPrice(new BigNumber(amount), tokenPrice);

                timeBlock = await addVolume(
                    timeBlock,
                    token,
                    amountWithPrice,
                    tokenPrice
                );

                if (latestLocked) {
                    const latestLockedWithPrice = applyPrice(
                        new BigNumber(latestLocked),
                        tokenPrice
                    );
                    timeBlock = await setLocked(
                        timeBlock,
                        token,
                        latestLockedWithPrice
                    );
                } else {
                    timeBlock = await subtractLocked(
                        timeBlock,
                        token,
                        amountWithPrice,
                        tokenPrice
                    );
                }

                // saveQueue.push(
                //     new Transaction(
                //         token,
                //         new BigNumber(amount)
                //             .negated()
                //             .toFixed(),
                //         renvmState.network,
                //         this.instance,
                //         timestamp.unix(),
                //         block.height
                //     )
                // );
            }
        } else {
            console.error(`Unrecognized selector format ${selector}`);
        }

        if (amountWithPrice) {
            const assetLockedAfter = timeBlock.lockedJSON.get(token)?.amount;

            console.log(
                `[${token === "BTC/Ethereum" ? yellow(token) : cyan(token)}][${
                    block.height
                }] ${
                    mintOrBurn === MintOrBurn.MINT
                        ? green(mintOrBurn)
                        : red(mintOrBurn)
                } ${amountWithPrice.amount
                    .div(new BigNumber(10).exponentiatedBy(8))
                    .toFixed()} ${magenta(asset)}`,
                "before",
                assetLockedBefore?.dividedBy(1e8).toFixed(),
                "after",
                assetLockedAfter?.dividedBy(1e8).toFixed(),
                "difference",
                assetLockedAfter
                    ?.minus(assetLockedBefore || new BigNumber(0))
                    .dividedBy(1e8)
                    .toFixed()
            );
        }

        return timeBlock;
    };

    blockHandler: BlockHandlerInterface = async (
        renVM: RenVMInstance,
        block: CommonBlock,
        blockState?: BlockState
    ) => {
        if (block.transactions.length > 0) {
            // Update timeBlock for each transaction.
            let timeBlock = await getTimeBlock(block.timestamp);
            for (let transaction of block.transactions) {
                timeBlock = await this.transactionHandler(
                    timeBlock,
                    transaction,
                    block,
                    blockState
                );
            }

            // Save timeBlock and renVM database entries atomically.
            renVM.syncedBlock = block.height;
            await this.connection.manager.save([renVM, timeBlock]);
        }
    };
}
