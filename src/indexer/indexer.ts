import { FilecoinNetwork } from "../database/models";
import { CRASH } from "../utils";
import { IndexerInterface } from "./base";
import { FilecoinIndexer } from "./filecoin";

export interface Indexers {
    [chain: string]: { [network: string]: IndexerInterface };
}

/**
 * runIndexer starts a loop for each chain's network.
 */
export const runIndexer = (): Indexers => {
    const filecoinTestnetIndexer = new FilecoinIndexer(FilecoinNetwork.Testnet);
    filecoinTestnetIndexer.start().catch(CRASH);

    const filecoinMainnetIndexer = new FilecoinIndexer(FilecoinNetwork.Mainnet);
    filecoinMainnetIndexer.start().catch(CRASH);

    return {
        [filecoinTestnetIndexer.name]: {
            [filecoinTestnetIndexer.network]: filecoinTestnetIndexer,
            [filecoinMainnetIndexer.network]: filecoinMainnetIndexer,
        },
    };
};
