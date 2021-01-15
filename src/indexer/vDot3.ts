import { RenVMProvider } from "@renproject/rpc/build/main/v2/renVMProvider";
import { RenVMProvider as RenVMProviderVDot2 } from "@renproject/rpc/build/main/v1/renVMProvider";
import {
    unmarshalBurnTx,
    unmarshalMintTx,
} from "@renproject/rpc/build/main/v2/unmarshal";

import { RenVMInstances } from "../database/models";
import { Connection } from "typeorm";
import { VDot2Indexer } from "./vDot2";
import {
    ResponseQueryBlocks,
    ResponseQueryTx,
} from "@renproject/rpc/build/main/v2";
import BigNumber from "bignumber.js";
import { Moment } from "moment";
import moment from "moment";

export class VDot3Indexer extends VDot2Indexer {
    name = "v0.3";

    BATCH_SIZE = 16;
    // const BATCH_COUNT = 1;

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

    latestBlock = async (
        client: RenVMProviderVDot2 | RenVMProvider
    ): Promise<number> =>
        (await client.queryBlock((undefined as unknown) as number)).block
            .height;

    getNextBatchOfBlocks = async (
        client: RenVMProviderVDot2 | RenVMProvider,
        fromBlock: number | undefined,
        n: number
    ): Promise<
        Array<{
            height: number;
            timestamp: Moment;
            transactions: Array<ResponseQueryTx["tx"]>;
        }>
    > => {
        const blocks: ResponseQueryBlocks["blocks"] = (
            await client.queryBlocks(
                (String(fromBlock) as any) as number,
                (String(n) as any) as number
            )
        ).blocks;
        return blocks.map((block: any) => {
            return {
                height: parseInt(block.height),
                timestamp: moment(
                    new BigNumber(block.timestamp)
                        .div(1000 * 1000)
                        .decimalPlaces(0)
                        .toNumber()
                ),
                transactions: Object.keys(block.extrinsics.shardTxs.txs).reduce(
                    (acc, key) => [
                        ...acc,
                        ...block.extrinsics.shardTxs.txs[key],
                    ],
                    [] as any[]
                ),
            };
        });
    };

    unmarshalBurn = unmarshalBurnTx;
    unmarshalMint = unmarshalMintTx;
}

export interface V3Block {
    blocks: Array<{
        extrinsics: {
            coreTxs: [];
            plan: {};
            shardTxs: {
                txResults: {};
                txs: {
                    AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA: [];
                };
            };
            state: "6UKjx_vF8EjgDjz9v1i3KfN_30mRma1Zto8RiNexUwg";
        };
        extrinsicsRootHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        hash: "TACrzOsSfiZLGgIceCK6pMhGwaBmDT3W7aMNIeGqycI";
        height: "630873";
        next: [];
        parentHash: "mYal3VzU9kGoIXBigiLZNFyTGnMOcbHPdgIEn3gjd3A";
        parentSignature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        timestamp: "1610583249695742541";
    }>;
}
