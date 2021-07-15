import BigNumber from "bignumber.js";
import { blue, cyan, green, yellow } from "chalk";
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
} from "@renproject/rpc/build/main/v2";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import {
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v2/unmarshal";

import {
    addLocked,
    addVolume,
    getTimeBlock,
    getTimestamp,
    MintOrBurn,
    parseSelector,
    RenVMInstances,
    subtractLocked,
    TimeBlock,
} from "../../database/models";
import { Transaction } from "../../database/models/Transaction";
import { IndexerClass } from "../base";
import { applyPrice, getTokenPrice } from "../PriceFetcher";

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

    unmarshalBurn = unmarshalBurnTx;
    unmarshalMint = unmarshalMintTx;

    async loop(client: RenVMProvider) {
        const renvmState = await this.readDatabase();

        let syncedHeight: number = renvmState.syncedBlock;

        const latestBlock = await this.latestBlock(client);

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

            console.warn(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Syncing from #${cyan(renvmState.syncedBlock)} to #${cyan(
                    toBlock
                )}${latestBlock.height === toBlock ? ` (latest)` : ""}`
            );

            let timeBlock: TimeBlock | undefined;

            let setBreak = false;

            // Database progress is saved in check-points, so entries that need
            // to be saved should be added to this.
            let saveQueue = [];

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
                        await this.connection.manager.save([
                            timeBlock,
                            renvmState,
                            ...saveQueue,
                        ]);
                        saveQueue = [];
                        timeBlock = undefined;
                    }

                    if (block.transactions.length > 0) {
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

                        console.warn(
                            `[${this.name.toLowerCase()}][${
                                renvmState.network
                            }] ${green("Processing transaction")} ${cyan(
                                txHash
                            )} in block ${block.height}`
                        );

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
                            mintOrBurn: MintOrBurn;
                        };
                        try {
                            parsed = parseSelector(selector);
                        } catch (error) {
                            console.warn(
                                `Unrecognized selector format ${selector}`
                            );
                            continue;
                        }
                        const { asset, token, mintOrBurn } = parsed;

                        timeBlock =
                            timeBlock || (await getTimeBlock(timestamp));

                        if (mintOrBurn === MintOrBurn.BURN) {
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

                                timeBlock.pricesJSON = timeBlock.pricesJSON.set(
                                    asset,
                                    {
                                        decimals: 0,
                                        priceInEth: 0,
                                        priceInBtc: 0,
                                        priceInUsd: 0,
                                        ...timeBlock.pricesJSON.get(asset),
                                        ...(await getTokenPrice(
                                            asset,
                                            timestamp
                                        )),
                                    }
                                );

                                const tokenPrice = timeBlock.pricesJSON.get(
                                    asset,
                                    undefined
                                );
                                const amountWithPrice = applyPrice(
                                    new BigNumber(amount),
                                    tokenPrice
                                );

                                timeBlock = await addVolume(
                                    timeBlock,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );

                                timeBlock = await subtractLocked(
                                    timeBlock,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );

                                if (
                                    this.instance === "mainnet" &&
                                    token === "BTC/Ethereum"
                                ) {
                                    console.log(
                                        `[${this.name.toLowerCase()}][${
                                            renvmState.network
                                        }] ${yellow(
                                            `${mintOrBurn} ${amountWithPrice.amount.div(
                                                new BigNumber(
                                                    10
                                                ).exponentiatedBy(8)
                                            )} BTC`
                                        )}`
                                    );
                                }

                                saveQueue.push(
                                    new Transaction(
                                        token,
                                        new BigNumber(amount)
                                            .negated()
                                            .toFixed(),
                                        renvmState.network,
                                        this.instance,
                                        timestamp.unix(),
                                        block.height
                                    )
                                );
                            }
                        } else if (mintOrBurn === MintOrBurn.MINT) {
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
                                    tx.out.revert === "")
                            ) {
                                const amount = (tx.out as any).amount;

                                timeBlock.pricesJSON = timeBlock.pricesJSON.set(
                                    asset,
                                    {
                                        decimals: 0,
                                        priceInEth: 0,
                                        priceInBtc: 0,
                                        priceInUsd: 0,
                                        ...timeBlock.pricesJSON.get(asset),
                                        ...(await getTokenPrice(
                                            asset,
                                            timestamp
                                        )),
                                    }
                                );

                                const tokenPrice = timeBlock.pricesJSON.get(
                                    asset,
                                    undefined
                                );
                                const amountWithPrice = applyPrice(
                                    new BigNumber(amount),
                                    tokenPrice
                                );

                                timeBlock = await addVolume(
                                    timeBlock,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );

                                timeBlock = await addLocked(
                                    timeBlock,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );

                                if (
                                    this.instance === "mainnet" &&
                                    token === "BTC/Ethereum"
                                ) {
                                    console.log(
                                        `[${this.name.toLowerCase()}][${
                                            renvmState.network
                                        }] ${mintOrBurn} ${amountWithPrice.amount
                                            .div(
                                                new BigNumber(
                                                    10
                                                ).exponentiatedBy(8)
                                            )
                                            .toFixed()} BTC`
                                    );
                                }

                                saveQueue.push(
                                    new Transaction(
                                        token,
                                        amount,
                                        renvmState.network,
                                        this.instance,
                                        timestamp.unix(),
                                        block.height
                                    )
                                );
                            }
                        } else {
                            console.error(
                                `Unrecognized selector format ${selector}`
                            );
                        }
                    }

                    latestProcessedHeight = Math.max(
                        block.height,
                        latestProcessedHeight
                    );
                }
            }

            renvmState.syncedBlock = latestProcessedHeight;
            if (timeBlock) {
                console.warn(
                    `[${this.name.toLowerCase()}][${
                        renvmState.network
                    }] Saving TimeBlock #${blue(timeBlock.timestamp)} ${yellow(
                        `(Locked BTC on Eth: ${timeBlock.lockedJSON
                            .get("BTC/Ethereum")
                            ?.amount.dividedBy(1e8)
                            .toFixed()})`
                    )}`
                );
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
            console.warn(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Already synced up to #${cyan(latestBlock.height)}`
            );
            renvmState.save();
        }
    }
}
