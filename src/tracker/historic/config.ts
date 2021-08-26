import { RenNetwork } from "src/networks";

export const INPUT_FILES = {
    [RenNetwork.Mainnet]: "src/tracker/historic/events/mainnet-chains.json",
    [RenNetwork.Testnet]: "src/tracker/historic/events/testnet-chains.json",
};

const HOUR = 60 * 60;

export interface NetworkConfig {
    historicChainEvents?: {
        pathname: string;
        fromTimestamp: number;
        toTimestamp: number;
    };
    historicRenVMBlocks?: {
        pathname: string;
        fromTimestamp: number;
        toTimestamp: number;
    };
    liveRenVM: {
        fromBlock: number;
    };
}

export const config: { [network in RenNetwork]: NetworkConfig } = {
    [RenNetwork.Mainnet]: {
        historicChainEvents: {
            pathname: "src/tracker/historic/events/mainnet-chains.json",
            fromTimestamp: 0,
            // Subtract to avoid counting burns twice, if they were processed
            // on-chain and then 1 hour later processed in RenVM.
            toTimestamp: 1624884114 - 2 * HOUR,
        },
        historicRenVMBlocks: {
            pathname: "src/tracker/historic/events/mainnet-renvm.json",
            fromTimestamp: 1624884114,
            toTimestamp: 1629802268,
        },
        liveRenVM: {
            fromBlock: 1,
        },
    },
    [RenNetwork.Testnet]: {
        historicChainEvents: {
            pathname: "src/tracker/historic/events/testnet-chains.json",
            fromTimestamp: 0,
            toTimestamp: 1628039181,
        },
        // historicRenVMBlocks: {},
        liveRenVM: {
            fromBlock: 1,
        },
    },
};
