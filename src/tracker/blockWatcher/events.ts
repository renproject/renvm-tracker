import BigNumber from "bignumber.js";
import { Moment } from "moment";

import { ResponseQueryTx } from "@renproject/rpc/build/main/v2";
import { RenVM } from "../../database/models";

export interface CommonBlock {
    height: number;
    timestamp: Moment;
    transactions: ResponseQueryTx[];
}

export interface BlockState {
    [asset: string]: {
        minted: Array<{ amount: BigNumber; chain: string }>;
        fees: {
            epochs: Array<{
                amount: BigNumber;
                epoch: BigNumber;
                numNodes: BigNumber;
            }>;
            unassigned: BigNumber;
        };
    };
}

export type BlockHandlerInterface = (
    renVM: RenVM,
    block: CommonBlock,
    blockState?: BlockState
) => Promise<void>;
