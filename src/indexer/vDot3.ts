import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import { RenVMProvider as RenVMProviderVDot2 } from "@renproject/rpc/build/main/v1/renVMProvider";
import {
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v2/unmarshal";

import { RenVMInstances } from "../database/models";
import { Connection } from "typeorm";
import { CommonBlock, VDot2Indexer } from "./vDot2";
import {
    ResponseQueryBlocks,
    ResponseQueryTx,
} from "@renproject/rpc/build/main/v2";
import BigNumber from "bignumber.js";
import { Moment } from "moment";
import moment from "moment";
import { NetworkSync } from "./networkSync";

export class VDot3Indexer extends VDot2Indexer {
    name: "v0.2" | "v0.3" = "v0.3";

    BATCH_SIZE = 16;
    // const BATCH_COUNT = 1;

    constructor(
        instance: RenVMInstances,
        connection: Connection,
        networkSync: NetworkSync
    ) {
        super(instance, connection, networkSync);
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
        client: RenVMProviderVDot2 | RenVMProvider
    ): Promise<CommonBlock> =>
        this.transformBlock(
            await (await client.queryBlock((undefined as unknown) as number))
                .block
        );

    getNextBatchOfBlocks = async (
        client: RenVMProviderVDot2 | RenVMProvider,
        fromBlock: number | undefined,
        n: number
    ): Promise<CommonBlock[]> => {
        const blocks: ResponseQueryBlocks["blocks"] = (
            await client.queryBlocks(
                (String(fromBlock) as any) as number,
                (String(n) as any) as number
            )
        ).blocks;
        return blocks.map(this.transformBlock);
    };

    transformBlock = (block: any): CommonBlock => ({
        height: parseInt(block.height),
        timestamp: moment(
            new BigNumber(block.timestamp)
                .div(1000 * 1000)
                .decimalPlaces(0)
                .toNumber()
        ),
        transactions: Object.keys(block.extrinsics.shardTxs.txs).reduce(
            (acc, key) => [...acc, ...block.extrinsics.shardTxs.txs[key]],
            [] as any[]
        ),
    });

    unmarshalBurn = unmarshalBurnTx;
    unmarshalMint = unmarshalMintTx;
}