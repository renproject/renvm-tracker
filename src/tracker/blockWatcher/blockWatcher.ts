import { red } from "chalk";
import moment, { Moment } from "moment";
import { Connection } from "typeorm";

import {
    ResponseQueryBlocks,
    unmarshalPackValue,
    ResponseQueryBlock,
} from "@renproject/rpc/build/main/v2";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";

import { RenVMInstance, RenVMInstances } from "../../database/models";
import { BlockState, CommonBlock, BlockHandlerInterface } from "./events";
import { SECONDS, sleep } from "../../util/utils";

export class BlockWatcher {
    latestTimestamp = 0;

    BATCH_SIZE = 16;

    blockSubscriptions: Array<BlockHandlerInterface> = [];

    client: RenVMProvider | null = null;
    instance: RenVMInstances;
    connection: Connection;

    name: string = "";

    constructor(instance: RenVMInstances, connection: Connection) {
        this.instance = instance;
        this.connection = connection;
    }

    async readDatabase() {
        return await RenVMInstance.findOneOrFail({
            name: this.instance,
        });
    }

    async start() {
        const client = await this.connect();

        while (true) {
            try {
                await this.loop(client);
            } catch (error) {
                console.error(error);
            }

            await sleep(10 * SECONDS);
        }
    }

    subscribe(event: "block", handler: BlockHandlerInterface) {
        switch (event) {
            case "block":
                this.blockSubscriptions.push(handler);
                return;
            default:
                throw new Error(`Unsupported event type "${event}".`);
        }
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

    latestBlock = async (
        client: RenVMProvider
    ): Promise<{ height: number; timestamp: Moment }> => {
        const rawBlock = await (
            await client.queryBlock(undefined as unknown as number)
        ).block;

        return {
            height: parseInt(rawBlock.height),
            timestamp: moment(rawBlock.timestamp * 1000),
        };
    };

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

        return await Promise.all(
            blocks.map(async (block: ResponseQueryBlock["block"]) => ({
                height: parseInt(block.height),
                timestamp: moment(block.timestamp * 1000),
                transactions: await Promise.all(
                    block.extrinsicTxs.map(
                        async (txHash: string) =>
                            await this.client?.queryTx(txHash)
                    )
                ),
            }))
        );
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
                `[${renvmState.network}] ${red(`Detected block reset.`)}`
            );
            renvmState.migrationCount = renvmState.migrationCount + 1;
            renvmState.syncedBlock = 1;
            syncedHeight = renvmState.syncedBlock;
        }

        if (syncedHeight === 1 && renvmState.migrationCount === 0) {
            console.warn(
                `[${renvmState.network}] Starting indexer fom latest block - ${
                    latestBlock.height
                } (${latestBlock.timestamp.unix()})`
            );

            // Start from latest block.
            renvmState.syncedBlock = latestBlock.height;
            syncedHeight = renvmState.syncedBlock;
        }

        if (!syncedHeight || latestBlock.height > syncedHeight) {
            for (
                let i = syncedHeight;
                i <= latestBlock.height;
                i += this.BATCH_SIZE
            ) {
                const latestBlocks = await this.getNextBatchOfBlocks(
                    client,
                    i,
                    syncedHeight && latestBlock.height
                        ? Math.min(
                              latestBlock.height - syncedHeight,
                              this.BATCH_SIZE
                          )
                        : this.BATCH_SIZE
                );

                for (const block of latestBlocks) {
                    for (const blockSubscription of this.blockSubscriptions) {
                        await blockSubscription(
                            renvmState,
                            block,
                            block.height === latestBlock.height
                                ? latestBlockState
                                : undefined
                        );
                    }
                }
            }

            await renvmState.save();
        }
    }
}
