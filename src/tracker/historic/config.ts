import unzipper from "unzipper";

import { RenNetwork } from "../../networks";
import { RenVMBlock } from "../blockWatcher/events";
import { HistoricEvent } from "./types";

const HOUR = 60 * 60;

export interface NetworkConfig {
    historicChainEvents?: {
        events: () => Promise<HistoricEvent[]>;
        fromTimestamp: number;
        toTimestamp: number;
    };
    historicRenVMBlocks?: {
        blocks: Array<() => Promise<RenVMBlock[]>>;
        fromTimestamp: number;
        toTimestamp: number;
    };
    liveRenVM: {
        fromBlock: number;
    };
}

const jsonFromZipPath = async <T>(filename: string): Promise<T> => {
    const zip = await unzipper.Open.file(filename);
    if (zip.files.length !== 1) {
        throw new Error(
            `Expected 1 file in ${filename}, got ${zip.files.length}.`
        );
    }
    const file = zip.files[0];
    const content = await file.buffer();
    return JSON.parse(content.toString());
};

export const networkConfigs: { [network in RenNetwork]: NetworkConfig } = {
    [RenNetwork.Mainnet]: {
        historicChainEvents: {
            events: async () =>
                await jsonFromZipPath<HistoricEvent[]>(
                    "src/tracker/historic/events/mainnet-chains.zip"
                ),
            fromTimestamp: 0,
            // Subtract to avoid counting burns twice, if they were processed
            // on-chain and then 1 hour later processed in RenVM.
            toTimestamp: 1624884114 - 2 * HOUR,
        },
        historicRenVMBlocks: {
            blocks: [
                async () =>
                    await jsonFromZipPath<RenVMBlock[]>(
                        "src/tracker/historic/events/mainnet-renvm-1.zip"
                    ),
                async () =>
                    await jsonFromZipPath<RenVMBlock[]>(
                        "src/tracker/historic/events/mainnet-renvm-2.zip"
                    ),
                    async () =>
                    await jsonFromZipPath<RenVMBlock[]>(
                        "src/tracker/historic/events/mainnet-renvm-3.zip"
                    ),
                    async () =>
                    await jsonFromZipPath<RenVMBlock[]>(
                        "src/tracker/historic/events/mainnet-renvm-4.zip"
                    ),
            ],
            fromTimestamp: 1624884114,
            toTimestamp: 1629802268,
        },
        liveRenVM: {
            fromBlock:  1,
        },
    },
    [RenNetwork.Testnet]: {
        historicChainEvents: {
            events: async () =>
                await jsonFromZipPath<HistoricEvent[]>(
                    "src/tracker/historic/events/testnet-chains.zip"
                ),
            fromTimestamp: 0,
            toTimestamp: 1628039181,
        },
        // historicRenVMBlocks: {},
        liveRenVM: {
            fromBlock: 104,
        },
    },
};
