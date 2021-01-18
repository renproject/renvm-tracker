import { RenVMProvider } from "@renproject/rpc/build/main/v1/renVMProvider";
import { RenVMProvider as RenVMProviderVDot3 } from "@renproject/rpc/build/main/v2/renVMProvider";
import {
    RenVMBlock,
    ResponseQueryBlocks,
    ResponseQueryBurnTx,
    ResponseQueryMintTx,
} from "@renproject/rpc/build/main/v1/methods";
import {
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v1/unmarshal";
import {
    TxStatus,
    BurnAndReleaseTransaction,
    LockAndMintTransaction,
} from "@renproject/interfaces";

import {
    addLocked,
    addVolume,
    defaultPartialTimeBlock,
    getTimestamp,
    MintOrBurn,
    parseSelector,
    PartialTimeBlock,
    RenVMInstances,
    subtractLocked,
    updateTimeBlocks,
} from "../database/models";
import { IndexerClass } from "./base";
import { applyPrice, getTokenPrice } from "./priceCache";
import moment, { Moment } from "moment";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { Connection } from "typeorm";
import { ResponseQueryTx } from "@renproject/rpc/build/main/v2/methods";
import { NetworkSync } from "./networkSync";
import { blue, cyan, green, yellow } from "chalk";

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

export class VDot2Indexer extends IndexerClass<
    RenVMProvider | RenVMProviderVDot3
> {
    name: "v0.2" | "v0.3" = "v0.2";

    BATCH_SIZE = 40;
    BATCH_COUNT = 100;

    latestTimestamp = 0;
    networkSync: NetworkSync;

    constructor(
        instance: RenVMInstances,
        connection: Connection,
        networkSync: NetworkSync
    ) {
        super(instance, connection);
        this.networkSync = networkSync;
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

    async loop(client: RenVMProvider) {
        const renvmState = await this.readDatabase();

        // Testnet v0.2 blocks at: 24040, 35506, 36399, 37415
        let syncedHeight: number = renvmState.syncedBlock;

        const currentTimestamp = getTimestamp(moment());

        const latestBlock = await this.latestBlock(client);

        // Detect migration - latest block height has been reset.
        if (syncedHeight > 1 && latestBlock.height < syncedHeight - 1000) {
            console.log(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Detected block reset.`
            );
            renvmState.migrationCount = renvmState.migrationCount + 1;
            renvmState.syncedBlock = 1;
            syncedHeight = renvmState.syncedBlock;
        }

        if (syncedHeight === 1 && renvmState.migrationCount === 0) {
            console.log(
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

            console.log(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Syncing from #${cyan(renvmState.syncedBlock)} to #${cyan(
                    toBlock
                )}${latestBlock.height === toBlock ? ` (latest)` : ""}`
            );

            let intermediateTimeBlocks = OrderedMap<number, PartialTimeBlock>();

            let setBreak = false;

            let latestProcessedHeight = syncedHeight;
            for (let i = syncedHeight; i <= toBlock; i += this.BATCH_SIZE) {
                if (setBreak) {
                    break;
                }
                process.stdout.write(`${i}\r`);
                const latestBlocks = await this.getNextBatchOfBlocks(
                    client,
                    i,
                    syncedHeight && toBlock
                        ? Math.min(toBlock - syncedHeight, this.BATCH_SIZE)
                        : this.BATCH_SIZE
                );

                for (const block of latestBlocks) {
                    // console.log(
                    //     `[${this.name.toLowerCase()}][${
                    //         renvmState.network
                    //     }] Processing block #${blue(block.height)}`
                    // );

                    const blockTimestamp = getTimestamp(block.timestamp);

                    const [
                        networkSynced,
                        networkSyncProgress,
                    ] = await this.networkSync.upTo(this.name, blockTimestamp);

                    if (!networkSynced) {
                        const difference =
                            networkSyncProgress === 0
                                ? "?"
                                : moment
                                      .duration(
                                          moment(blockTimestamp * 1000).diff(
                                              networkSyncProgress * 1000
                                          )
                                      )
                                      .humanize();
                        console.log(
                            `[${this.name.toLowerCase()}][${
                                renvmState.network
                            }] Waiting for other network to get to ${blockTimestamp} (${yellow(
                                difference
                            )} behind)`
                        );
                        setBreak = true;
                        break;
                    }

                    latestProcessedHeight = Math.max(
                        block.height,
                        latestProcessedHeight
                    );

                    // process.stdout.write(`${block.height}\r`);
                    for (let transaction of block.transactions) {
                        const txHash =
                            typeof transaction === "string"
                                ? transaction
                                : transaction.hash;

                        console.log(
                            `[${this.name.toLowerCase()}][${
                                renvmState.network
                            }] ${green("Processing transaction")} ${cyan(
                                txHash
                            )} in block ${block.height}`
                        );

                        if (typeof transaction === "string") {
                            transaction = (await client.queryTx(transaction))
                                .tx as any;
                        }

                        let selector;
                        selector =
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

                        const timestamp = block.timestamp;

                        let intermediateTimeBlock = intermediateTimeBlocks.get(
                            getTimestamp(timestamp),
                            { ...defaultPartialTimeBlock }
                        );

                        if (mintOrBurn === MintOrBurn.BURN) {
                            // Burn

                            let tx = this.unmarshalBurn({
                                tx: transaction as ResponseQueryBurnTx["tx"],
                                txStatus: TxStatus.TxStatusDone,
                            });

                            const amount = tx.in.amount;

                            const previousTimeBlock = intermediateTimeBlocks.last(
                                undefined
                            );
                            intermediateTimeBlock.pricesJSON = intermediateTimeBlock.pricesJSON.set(
                                asset,
                                {
                                    decimals: 0,
                                    priceInEth: 0,
                                    priceInBtc: 0,
                                    priceInUsd: 0,
                                    ...(previousTimeBlock
                                        ? previousTimeBlock.pricesJSON.get(
                                              asset,
                                              undefined
                                          )
                                        : undefined),
                                    ...intermediateTimeBlock.pricesJSON.get(
                                        asset,
                                        undefined
                                    ),
                                    ...(await getTokenPrice(asset, timestamp)),
                                }
                            );

                            const tokenPrice = intermediateTimeBlock.pricesJSON.get(
                                asset,
                                undefined
                            );
                            const amountWithPrice = applyPrice(
                                new BigNumber(amount),
                                tokenPrice
                            );

                            intermediateTimeBlock = await addVolume(
                                intermediateTimeBlock,
                                renvmState.network,
                                token,
                                amountWithPrice,
                                tokenPrice
                            );

                            intermediateTimeBlock = await subtractLocked(
                                intermediateTimeBlock,
                                renvmState.network,
                                token,
                                amountWithPrice,
                                tokenPrice
                            );
                        } else if (mintOrBurn === MintOrBurn.MINT) {
                            // Mint

                            let tx = this.unmarshalMint({
                                tx: transaction as ResponseQueryMintTx["tx"],
                                txStatus: TxStatus.TxStatusDone,
                            });

                            // If the transaction doesn't have an `out` value, it
                            // may have been reverted.
                            if (tx.out && tx.out.revert === undefined) {
                                const amount = tx.out.amount;

                                const previousTimeBlock = intermediateTimeBlocks.last(
                                    undefined
                                );
                                intermediateTimeBlock.pricesJSON = intermediateTimeBlock.pricesJSON.set(
                                    asset,
                                    {
                                        decimals: 0,
                                        priceInEth: 0,
                                        priceInBtc: 0,
                                        priceInUsd: 0,
                                        ...(previousTimeBlock
                                            ? previousTimeBlock.pricesJSON.get(
                                                  asset,
                                                  undefined
                                              )
                                            : undefined),
                                        ...intermediateTimeBlock.pricesJSON.get(
                                            asset,
                                            undefined
                                        ),
                                        ...(await getTokenPrice(
                                            asset,
                                            timestamp
                                        )),
                                    }
                                );

                                const tokenPrice = intermediateTimeBlock.pricesJSON.get(
                                    asset,
                                    undefined
                                );
                                const amountWithPrice = applyPrice(
                                    new BigNumber(amount),
                                    tokenPrice
                                );

                                intermediateTimeBlock = await addVolume(
                                    intermediateTimeBlock,
                                    renvmState.network,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );

                                intermediateTimeBlock = await addLocked(
                                    intermediateTimeBlock,
                                    renvmState.network,
                                    token,
                                    amountWithPrice,
                                    tokenPrice
                                );
                            }
                        } else {
                            console.error(
                                `Unrecognized selector format ${selector}`
                            );
                        }

                        intermediateTimeBlocks = intermediateTimeBlocks.set(
                            getTimestamp(timestamp),
                            intermediateTimeBlock
                        );
                    }
                }
            }

            if (latestProcessedHeight > renvmState.syncedBlock) {
                console.error(
                    `[${this.name.toLowerCase()}][${
                        renvmState.network
                    }] Processed ${blue(
                        latestProcessedHeight - renvmState.syncedBlock
                    )} blocks.`
                );
            }
            renvmState.syncedBlock = latestProcessedHeight;
            await updateTimeBlocks(
                intermediateTimeBlocks,
                renvmState,
                this.connection
            );
            // await renvmState.save();
        } else {
            console.log(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Already synced up to #${cyan(latestBlock.height)}`
            );
            await this.networkSync.upTo(this.name, currentTimestamp);
            renvmState.save();
        }
    }

    latestBlock = async (
        client: RenVMProvider | RenVMProviderVDot3
    ): Promise<CommonBlock> =>
        this.transformBlock(
            (await client.queryBlock((undefined as unknown) as number)).block
        );

    getNextBatchOfBlocks = async (
        client: RenVMProvider | RenVMProviderVDot3,
        fromBlock: number | undefined,
        n: number
    ): Promise<CommonBlock[]> => {
        const blocks: ResponseQueryBlocks["blocks"] = (
            await client.queryBlocks(fromBlock as number, n)
        ).blocks;
        return blocks.map(this.transformBlock);
    };

    transformBlock = (block: RenVMBlock): CommonBlock => ({
        height: block.header.height,
        timestamp: moment(
            new BigNumber(block.header.timestamp).times(1000).toNumber()
        ),
        transactions: block.data,
    });

    unmarshalBurn = unmarshalBurnTx as (
        response: any
    ) => BurnAndReleaseTransaction;
    unmarshalMint = unmarshalMintTx as (
        response: any
    ) => LockAndMintTransaction;
}
