import { red, yellow } from "chalk";
import moment, { Moment } from "moment";
import { Connection } from "typeorm";

import {
    ResponseQueryBlocks,
    unmarshalPackValue,
    ResponseQueryBlock,
    ResponseQueryTx,
} from "@renproject/rpc/build/main/v2";
import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";

import { RenVMProgress } from "../../database/models";
import { RenNetwork } from "../../networks";
import {
    BlockState,
    CommonBlock,
    BlockHandlerInterface,
    RenVMBlock,
} from "./events";
import { SECONDS, sleep } from "../../common/utils";

export class BlockWatcher {
    batchSize = 16;

    blockSubscriptions: Array<BlockHandlerInterface> = [];

    client: RenVMProvider | null = null;
    network: RenNetwork;
    connection: Connection;

    constructor(network: RenNetwork, connection: Connection) {
        this.network = network;
        this.connection = connection;
    }

    start = async () => {
        const client = await this.connect();

        while (true) {
            try {
                await this.loop(client);
            } catch (error) {
                console.error(error);
            }

            await sleep(10 * SECONDS);
        }
    };

    subscribe = (event: "block", handler: BlockHandlerInterface) => {
        switch (event) {
            case "block":
                this.blockSubscriptions.push(handler);
                return;
            default:
                throw new Error(`Unsupported event type "${event}".`);
        }
    };

    connect = async () => {
        if (this.client) {
            return this.client;
        }

        const client = new RenVMProvider(this.network);
        this.client = client;

        return client;
    };

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

    getNextBlockBatch = async (
        client: RenVMProvider,
        fromBlock: number | undefined,
        n: number
    ): Promise<CommonBlock[]> => {
        const blocks: RenVMBlock[] = (
            await client.queryBlocks(
                String(fromBlock) as any as number,
                String(n) as any as number
            )
        ).blocks;

        let randomDelayRange = 0;
        while (true) {
            try {
                return await Promise.all(
                    blocks.map((block) =>
                        fetchBlockTransactions(client, block, randomDelayRange)
                    )
                );
            } catch (error) {
                console.error(`Failed to fetch transactions.`);
                console.error(error);
                randomDelayRange += 10 * SECONDS;
            }
        }
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

    loop = async (client: RenVMProvider) => {
        const renvmState = await RenVMProgress.findOneOrFail();

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
                `[${yellow(this.network)}] ${red(`Detected block reset.`)}`
            );
            renvmState.migrationCount = renvmState.migrationCount + 1;
            renvmState.syncedBlock = 0;
            syncedHeight = renvmState.syncedBlock;
        }

        if (syncedHeight === 1 && renvmState.migrationCount === 0) {
            console.warn(
                `[${yellow(
                    this.network
                )}] Starting indexer fom latest block - ${
                    latestBlock.height
                } (${latestBlock.timestamp.unix()})`
            );

            // Start from latest block.
            renvmState.syncedBlock = latestBlock.height;
            syncedHeight = renvmState.syncedBlock;
        }

        if (!syncedHeight || latestBlock.height > syncedHeight) {
            while (syncedHeight < latestBlock.height) {
                const fromBlock = syncedHeight + 1;

                // NOTE - we shouldn't assume it will return this number of
                // blocks - may return less or more.
                const blocksToFetch = Math.min(
                    this.batchSize,
                    latestBlock.height - syncedHeight
                );

                console.log(
                    `[${yellow(
                        this.network
                    )}] Getting ${blocksToFetch} blocks from ${fromBlock} (latest: ${
                        latestBlock.height
                    } - ${latestBlock.height - syncedHeight} behind).`
                );
                const latestBlocks = await this.getNextBlockBatch(
                    client,
                    fromBlock,
                    blocksToFetch
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

                // Set the synced height to the height block that was fetched.
                syncedHeight = latestBlocks.reduce(
                    (acc, block) => Math.max(acc, block.height),
                    syncedHeight
                );
            }

            // Save the synced height.
            renvmState.syncedBlock = syncedHeight;
            await renvmState.save();
        }
    };
}

/**
 * Replaces RenVM hashes with the transaction details.
 *
 * @param client A RenVMProvider
 * @param block A block object as returned from a ren_queryBlock.
 * @returns A Promise to the block with RenVM hashes replaced by transaction
 * details.
 */
export const fetchBlockTransactions = async (
    client: RenVMProvider,
    block: RenVMBlock,
    randomDelayRange?: number
): Promise<CommonBlock> => ({
    height: parseInt(block.height),
    timestamp: moment(parseInt(block.timestamp) * 1000),
    transactions: await Promise.all(
        block.extrinsicTxs.map(
            async (txHash: string): Promise<ResponseQueryTx> => {
                console.log(`Fetching transaction ${txHash}`);
                if (randomDelayRange) {
                    await sleep(Math.random() * randomDelayRange);
                }
                return await client.queryTx(txHash);
            }
        )
    ),
});
