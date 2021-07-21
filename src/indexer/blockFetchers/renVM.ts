import BigNumber from "bignumber.js";
import { blue, cyan, green, yellow, magenta, red } from "chalk";
import moment, { Moment } from "moment";
import { Connection } from "typeorm";

import { TxStatus } from "@renproject/interfaces";
import {
    ResponseQueryBurnTx,
    ResponseQueryMintTx,
} from "@renproject/rpc/build/main/v1/methods";
import {
    ResponseQueryBlocks,
    ResponseQueryTx,
    unmarshalPackValue,
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v2";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";

import {
    addLocked,
    addVolume,
    getTimeBlock,
    getTimestamp,
    MintOrBurn,
    parseSelector,
    RenVMInstances,
    setLocked,
    subtractLocked,
    TimeBlock,
    updateTokenPrice,
} from "../../database/models";
import { Transaction } from "../../database/models/Transaction";
import { IndexerClass } from "../base";
import { applyPrice } from "../PriceFetcher";
import { DEBUG } from "../../environmentVariables";
import { TokenAmount } from "../../database/models/amounts";

export interface CommonBlock<
    T =
        | ResponseQueryMintTx["tx"]
        | ResponseQueryBurnTx["tx"]
        | ResponseQueryTx["tx"]
> {
    height: number;
    timestamp: Moment;
    transactions: Array<T>;
}

interface BlockState {
    [asset: string]: {
        minted: Array<{ amount: BigNumber; chain: string }>;
    };
}

export class RenVMIndexer extends IndexerClass<RenVMProvider> {
    latestTimestamp = 0;

    name = "v0.3";

    BATCH_SIZE = 16;
    BATCH_COUNT = 40;

    constructor(instance: RenVMInstances, connection: Connection) {
        super(instance, connection);
    }

    async connect() {
        if (this.client) {
            return this.client;
        }

        const renvmState = await this.readDatabase();

        const client = new RenVMProvider(renvmState.name);
        this.client = client;

        return client;
    }

    latestBlock = async (client: RenVMProvider): Promise<CommonBlock> =>
        this.transformBlock(
            await (
                await client.queryBlock(undefined as unknown as number)
            ).block
        );

    getNextBatchOfBlocks = async (
        client: RenVMProvider,
        fromBlock: number | undefined,
        n: number
    ): Promise<CommonBlock[]> => {
        const blocks: ResponseQueryBlocks["blocks"] = (
            await client.queryBlocks(
                String(fromBlock) as any as number,
                String(n) as any as number
            )
        ).blocks;
        return blocks.map(this.transformBlock);
    };

    transformBlock = (block: any): CommonBlock => {
        return {
            height: parseInt(block.height),
            timestamp: moment(block.timestamp * 1000),
            transactions: block.extrinsicTxs,
        };
    };

    getBlockState = async (client: RenVMProvider): Promise<BlockState> => {
        const latestBlockState = await client.sendMessage(
            "ren_queryBlockState" as any,
            {}
        );

        return unmarshalPackValue(
            latestBlockState.state.t,
            latestBlockState.state.v
        );
    };

    unmarshalBurn = unmarshalBurnTx;
    unmarshalMint = unmarshalMintTx;

    async loop(client: RenVMProvider) {
        const renvmState = await this.readDatabase();

        let syncedHeight: number = renvmState.syncedBlock;

        const latestBlock = await this.latestBlock(client);
        // `latestBlockState` doesn't take a block parameter, and there may be a
        // block created between fetching the latest block and the latest block
        // state. We fetch the state after so that any transactions in the block
        // are reflected in the state.
        let latestBlockState: BlockState | undefined;
        try {
            latestBlockState = await this.getBlockState(client);
        } catch (error) {
            console.error(error);
        }

        // Detect migration - latest block height has been reset.
        if (syncedHeight > 1 && latestBlock.height < syncedHeight - 1000) {
            console.warn(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Detected block reset.`
            );
            renvmState.migrationCount = renvmState.migrationCount + 1;
            renvmState.syncedBlock = 1;
            syncedHeight = renvmState.syncedBlock;
        }

        if (syncedHeight === 1 && renvmState.migrationCount === 0) {
            console.warn(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Starting indexer fom latest block - ${
                    latestBlock.height
                } (${latestBlock.timestamp.unix()})`
            );

            // Start from latest block.
            renvmState.syncedBlock = latestBlock.height;
            syncedHeight = renvmState.syncedBlock;
        }

        if (!syncedHeight || latestBlock.height > syncedHeight) {
            // const toBlock = syncedHeight
            const toBlock = Math.min(
                latestBlock.height,
                syncedHeight + this.BATCH_SIZE * this.BATCH_COUNT - 1
            );

            if (DEBUG) {
                console.warn(
                    `[${this.name.toLowerCase()}][${
                        renvmState.network
                    }] Syncing from #${cyan(renvmState.syncedBlock)} to #${cyan(
                        toBlock
                    )}${latestBlock.height === toBlock ? ` (latest)` : ""}`
                );
            }

            let timeBlock: TimeBlock | undefined;

            let setBreak = false;

            // Database progress is saved in check-points, so entries that need
            // to be saved should be added to this.
            let saveQueue: any[] = [];

            let latestProcessedHeight = syncedHeight;
            for (let i = syncedHeight; i <= toBlock; i += this.BATCH_SIZE) {
                if (setBreak) {
                    break;
                }

                const latestBlocks = await this.getNextBatchOfBlocks(
                    client,
                    i,
                    syncedHeight && toBlock
                        ? Math.min(toBlock - syncedHeight, this.BATCH_SIZE)
                        : this.BATCH_SIZE
                );

                for (const block of latestBlocks) {
                    const timestamp = block.timestamp;

                    if (
                        timeBlock &&
                        timeBlock.timestamp !== getTimestamp(timestamp)
                    ) {
                        renvmState.syncedBlock = latestProcessedHeight;
                        if (DEBUG) {
                            console.warn(
                                `[${this.name.toLowerCase()}][${
                                    renvmState.network
                                }] Saving TimeBlock #${blue(
                                    timeBlock.timestamp
                                )} ${yellow(
                                    `(Locked BTC on Eth: ${timeBlock.lockedJSON
                                        .get("BTC/Ethereum")
                                        ?.amount.dividedBy(1e8)
                                        .toFixed()} BTC)`
                                )}`
                            );
                        }
                        await this.connection.manager.save([
                            timeBlock,
                            renvmState,
                            ...saveQueue,
                        ]);
                        saveQueue = [];
                        timeBlock = undefined;
                    }

                    if (block.transactions.length > 0) {
                        if (DEBUG) {
                            console.warn(
                                `[${this.name.toLowerCase()}][${
                                    renvmState.network
                                }] Processing block #${blue(block.height)}`
                            );
                        }

                        for (let transaction of block.transactions) {
                            const txHash =
                                typeof transaction === "string"
                                    ? transaction
                                    : transaction.hash;

                            if (DEBUG) {
                                console.warn(
                                    `[${this.name.toLowerCase()}][${
                                        renvmState.network
                                    }] ${green(
                                        "Processing transaction"
                                    )} ${cyan(txHash)} in block ${block.height}`
                                );
                            }

                            if (typeof transaction === "string") {
                                try {
                                    transaction = (
                                        await client.queryTx(transaction)
                                    ).tx as any;
                                } catch (error) {
                                    if (
                                        /Node returned status 404 with reason: .* not found/.exec(
                                            error.message
                                        )
                                    ) {
                                        console.warn(
                                            `[${this.name.toLowerCase()}][${
                                                renvmState.network
                                            }] Ignoring transaction ${green(
                                                transaction
                                            )}`,
                                            error
                                        );
                                        continue;
                                    } else {
                                        throw error;
                                    }
                                }
                            }

                            const selector =
                                (transaction as ResponseQueryMintTx["tx"]).to ||
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
                                    console.warn(
                                        `Unrecognized selector format ${selector}`
                                    );
                                }
                                continue;
                            }
                            const { asset, token, mintOrBurn } = parsed;

                            timeBlock =
                                timeBlock || (await getTimeBlock(timestamp));

                            const assetLockedBefore =
                                timeBlock.lockedJSON.get(token)?.amount;

                            const latestLocked =
                                block.height === latestBlock.height &&
                                latestBlockState &&
                                latestBlockState[asset].minted.filter(
                                    (amount) => amount.chain === parsed.chain
                                )[0]?.amount;

                            let amountWithPrice: TokenAmount | undefined;
                            if (mintOrBurn === MintOrBurn.MINT) {
                                // Mint

                                let tx = this.unmarshalMint({
                                    tx: transaction as any, // as ResponseQueryMintTx["tx"],
                                    txStatus: TxStatus.TxStatusDone,
                                });

                                // If the transaction doesn't have an `out` value, it
                                // may have been reverted.
                                if (
                                    tx.out &&
                                    (tx.out.revert === undefined ||
                                        (tx.out.revert as any) === "")
                                ) {
                                    const amount = (tx.out as any).amount;

                                    timeBlock = await updateTokenPrice(
                                        timeBlock,
                                        asset,
                                        timestamp
                                    );

                                    const tokenPrice = timeBlock.pricesJSON.get(
                                        asset,
                                        undefined
                                    );
                                    amountWithPrice = applyPrice(
                                        new BigNumber(amount),
                                        tokenPrice
                                    );

                                    timeBlock = await addVolume(
                                        timeBlock,
                                        token,
                                        amountWithPrice,
                                        tokenPrice
                                    );

                                    if (latestLocked) {
                                        const latestLockedWithPrice =
                                            applyPrice(
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

                                let tx = this.unmarshalBurn({
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
                                        timestamp
                                    );

                                    const tokenPrice = timeBlock.pricesJSON.get(
                                        asset,
                                        undefined
                                    );
                                    amountWithPrice = applyPrice(
                                        new BigNumber(amount),
                                        tokenPrice
                                    );

                                    timeBlock = await addVolume(
                                        timeBlock,
                                        token,
                                        amountWithPrice,
                                        tokenPrice
                                    );

                                    if (latestLocked) {
                                        const latestLockedWithPrice =
                                            applyPrice(
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
                                console.error(
                                    `Unrecognized selector format ${selector}`
                                );
                            }

                            if (amountWithPrice) {
                                const assetLockedAfter =
                                    timeBlock.lockedJSON.get(token)?.amount;

                                console.log(
                                    `[${
                                        token === "BTC/Ethereum"
                                            ? yellow(token)
                                            : cyan(token)
                                    }][${block.height}] ${
                                        mintOrBurn === MintOrBurn.MINT
                                            ? green(mintOrBurn)
                                            : red(mintOrBurn)
                                    } ${amountWithPrice.amount
                                        .div(
                                            new BigNumber(10).exponentiatedBy(8)
                                        )
                                        .toFixed()} ${magenta(asset)}`,
                                    "before",
                                    assetLockedBefore?.dividedBy(1e8).toFixed(),
                                    "after",
                                    assetLockedAfter?.dividedBy(1e8).toFixed(),
                                    "difference",
                                    assetLockedAfter
                                        ?.minus(
                                            assetLockedBefore ||
                                                new BigNumber(0)
                                        )
                                        .dividedBy(1e8)
                                        .toFixed()
                                );
                            }
                        }
                    }

                    latestProcessedHeight = Math.max(
                        block.height,
                        latestProcessedHeight
                    );

                    if (timeBlock) {
                        renvmState.syncedBlock = latestProcessedHeight;
                        if (DEBUG) {
                            console.warn(
                                `[${this.name.toLowerCase()}][${
                                    renvmState.network
                                }] Saving TimeBlock #${blue(
                                    timeBlock.timestamp
                                )} ${yellow(
                                    `(Locked BTC on Eth: ${timeBlock.lockedJSON
                                        .get("BTC/Ethereum")
                                        ?.amount.dividedBy(1e8)
                                        .toFixed()} BTC)`
                                )}`
                            );
                        }
                        await this.connection.manager.save([
                            timeBlock,
                            renvmState,
                            ...saveQueue,
                        ]);
                        saveQueue = [];
                        timeBlock = undefined;
                    }
                }
            }

            renvmState.syncedBlock = latestProcessedHeight;
            if (timeBlock) {
                if (DEBUG) {
                    console.warn(
                        `[${this.name.toLowerCase()}][${
                            renvmState.network
                        }] Saving TimeBlock #${blue(
                            timeBlock.timestamp
                        )} ${yellow(
                            `(Locked BTC on Eth: ${timeBlock.lockedJSON
                                .get("BTC/Ethereum")
                                ?.amount.dividedBy(1e8)
                                .toFixed()})`
                        )}`
                    );
                }
                await this.connection.manager.save([
                    timeBlock,
                    renvmState,
                    ...saveQueue,
                ]);
            } else {
                await this.connection.manager.save([renvmState, ...saveQueue]);
            }
            saveQueue = [];
        } else {
            if (DEBUG) {
                console.warn(
                    `[${this.name.toLowerCase()}][${
                        renvmState.network
                    }] Already synced up to #${cyan(latestBlock.height)}`
                );
            }
            renvmState.save();
        }
    }
}
