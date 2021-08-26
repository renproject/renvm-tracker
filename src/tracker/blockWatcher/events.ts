import BigNumber from "bignumber.js";
import { Moment } from "moment";

import { ResponseQueryTx } from "@renproject/rpc/build/main/v2";
import { RenVMProgress } from "../../database/models";

export interface RenVMBlock {
    hash: string; // "ya2m2JvKhyYT5MaCA5_9DPwmkFepQrxV6J3gdle5jeU";
    height: string; // "56";
    round: string; // "0";
    timestamp: string; // "1624884963";
    stateRoot: string; // "IaRMaWR5opyLYt8omFuI54mLgPE3IHMG4J1eDqcOZ3M";
    intrinsicTxs: string[]; // ["GPqdAl8sEkhja7OzQ-Cp5_z0WtontDfVYVXrAG8YJxg"];
    extrinsicTxs: string[]; // ["uocFEPX6zgEUw8cwR-TZa_nK3zak0RUvn4h8t_Z1EqM"];
    parentHash: string; // "SNA4RTwSGDhPzqKF1o0fuJt5rlQBEuVCpVivG-6XxbM";
    commitment: string[]; // ["-LQl5upHSgyKCc3_1E3RADSBwO5pm-Hjuz8hz8evrwg3jj1Ek1uRzZyxGC4fNRYbq5P0qGVMJkmwQXECIqGcOgE"];
}

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
    renVM: RenVMProgress,
    block: CommonBlock,
    blockState?: BlockState
) => Promise<void>;
