import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import { RenVMProvider as RenVMProviderVDot2 } from "@renproject/rpc/build/main/v1/renVMProvider";
import {
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v2/unmarshal";

import { RenVMInstances, TimeBlock } from "../../database/models";
import { Connection } from "typeorm";
import { CommonBlock, VDot2Indexer } from "./vDot2";
import {
    ResponseQueryBlocks,
    ResponseQueryTx,
} from "@renproject/rpc/build/main/v2";
import BigNumber from "bignumber.js";
import { Moment } from "moment";
import moment from "moment";

export class VDot3Indexer extends VDot2Indexer {
    name: "v0.2" | "v0.3" = "v0.3";

    BATCH_SIZE = 16;

    constructor(instance: RenVMInstances, connection: Connection) {
        super(instance, connection);

        this.TimeBlockVersion = TimeBlock;
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
            await (
                await client.queryBlock(undefined as unknown as number)
            ).block
        );

    getNextBatchOfBlocks = async (
        client: RenVMProviderVDot2 | RenVMProvider,
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
}
