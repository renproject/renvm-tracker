import BigNumber from "bignumber.js";
import { Moment } from "moment";

import { ResponseQueryTx } from "@renproject/rpc/build/main/v2";
import { RenVMInstance } from "src/database/models";
import { Connection } from "typeorm";

export interface CommonBlock {
    height: number;
    timestamp: Moment;
    transactions: ResponseQueryTx[];
}

export interface BlockState {
    [asset: string]: {
        minted: Array<{ amount: BigNumber; chain: string }>;
    };
}

export type BlockHandlerInterface = (
    renVM: RenVMInstance,
    block: CommonBlock,
    blockState?: BlockState
) => Promise<void>;
