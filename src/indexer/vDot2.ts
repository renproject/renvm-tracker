import { RenVMProvider } from "@renproject/rpc/build/main/v1/renVMProvider";
import { RenVMProvider as RenVMProviderVDot3 } from "@renproject/rpc/build/main/v2/renVMProvider";
import {
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
import { CYAN, RESET } from "../utils";
import { IndexerClass } from "./base";
import { applyPrice, getTokenPrice } from "./priceCache";
import moment, { Moment } from "moment";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { Connection } from "typeorm";
import { ResponseQueryTx } from "@renproject/rpc/build/main/v2/methods";

export class VDot2Indexer extends IndexerClass<
    RenVMProvider | RenVMProviderVDot3
> {
    name = "v0.2";

    BATCH_SIZE = 40;
    BATCH_COUNT = 100;

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

    async loop(client: RenVMProvider) {
        const renvmState = await this.readDatabase();

        // Testnet v0.2 blocks at: 24040, 35506, 36399, 37415
        let syncedHeight: number = renvmState.syncedBlock;

        const latestHeight = await this.latestBlock(client);

        // Detect migration - latest block height has been reset.
        if (syncedHeight > 1 && latestHeight < syncedHeight - 1000) {
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
                }] Starting indexer fom latest block.`
            );

            // Start from latest block.
            renvmState.syncedBlock = latestHeight;
            syncedHeight = renvmState.syncedBlock;
        }

        if (!syncedHeight || latestHeight > syncedHeight) {
            // const toBlock = syncedHeight
            const toBlock = Math.min(
                latestHeight,
                syncedHeight + this.BATCH_SIZE * this.BATCH_COUNT - 1
            );

            console.log(
                `[${this.name.toLowerCase()}][${
                    renvmState.network
                }] Syncing from ${CYAN}${
                    renvmState.syncedBlock
                }${RESET} to ${CYAN}${toBlock}${RESET}`
            );

            let intermediateTimeBlocks = OrderedMap<number, PartialTimeBlock>();

            let latestBlock = toBlock || 0;
            for (let i = syncedHeight; i <= toBlock; i += this.BATCH_SIZE) {
                // process.stdout.write(`${i}\r`);
                const latestBlocks = await this.getNextBatchOfBlocks(
                    client,
                    i,
                    syncedHeight && toBlock
                        ? Math.min(toBlock - syncedHeight, this.BATCH_SIZE)
                        : this.BATCH_SIZE
                );

                latestBlock = latestBlocks.reduce(
                    (max, block) => Math.max(max, block.height),
                    toBlock || 0
                );

                for (const block of latestBlocks) {
                    process.stdout.write(`${block.height}\r`);
                    for (let transaction of block.transactions) {
                        const txHash =
                            typeof transaction === "string"
                                ? transaction
                                : transaction.hash;

                        console.log(
                            `[${this.name.toLowerCase()}][${
                                renvmState.network
                            }] Processing transaction ${CYAN}${txHash}${RESET} in block ${
                                block.height
                            }`
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

            console.log(
                JSON.stringify(intermediateTimeBlocks.toJS(), null, "    ")
            );

            renvmState.syncedBlock = latestBlock;
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
                }] Already synced up to ${CYAN}${latestHeight}${RESET}`
            );
            renvmState.save();
        }
    }

    latestBlock = async (
        client: RenVMProvider | RenVMProviderVDot3
    ): Promise<number> =>
        (await client.queryBlock((undefined as unknown) as number)).block.header
            .height;

    getNextBatchOfBlocks = async (
        client: RenVMProvider | RenVMProviderVDot3,
        fromBlock: number | undefined,
        n: number
    ): Promise<
        Array<{
            height: number;
            timestamp: Moment;
            transactions: Array<
                | ResponseQueryMintTx["tx"]
                | ResponseQueryBurnTx["tx"]
                | ResponseQueryTx["tx"]
            >;
        }>
    > => {
        const blocks: ResponseQueryBlocks["blocks"] = (
            await client.queryBlocks(fromBlock as number, n)
        ).blocks;
        return blocks.map((block) => ({
            height: block.header.height,
            timestamp: moment(
                new BigNumber(block.header.timestamp).times(1000).toNumber()
            ),
            transactions: block.data,
        }));
    };

    unmarshalBurn = unmarshalBurnTx as (
        response: any
    ) => BurnAndReleaseTransaction;
    unmarshalMint = unmarshalMintTx as (
        response: any
    ) => LockAndMintTransaction;
}
