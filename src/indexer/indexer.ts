import { Connection } from "typeorm";
import { RenVMInstances } from "../database/models";
import { CRASH } from "../utils";
import { IndexerClass } from "./base";
import { NetworkSync } from "./networkSync";
import { VDot2Indexer } from "./vDot2";
import { VDot3Indexer } from "./vDot3";
import { processEvents, Web3Event } from "./web3";
import { readFile } from "fs";
import { List } from "immutable";

export interface Indexers {
    [instances: string]: IndexerClass<unknown>;
}

/**
 * runIndexer starts a loop for each chain's network.
 */
export const runIndexer = (
    connection: Connection,
    initialize: boolean
): Indexers => {
    // const testnetSync = new NetworkSync();
    // const mainnetSync = new NetworkSync(true);

    const startIndexers = () => {
        // const testnetVDot2Indexer = new VDot2Indexer(
        //     RenVMInstances.Testnet,
        //     connection,
        //     testnetSync
        // );
        // testnetVDot2Indexer.start().catch(CRASH);
        const mainnetVDot2Indexer = new VDot2Indexer(
            RenVMInstances.Mainnet,
            connection
            // mainnetSync
        );
        mainnetVDot2Indexer.start().catch(CRASH);
        // const testnetVDot3Indexer = new VDot3Indexer(
        //     RenVMInstances.TestnetVDot3,
        //     connection,
        //     testnetSync
        // );
        // testnetVDot3Indexer.start().catch(CRASH);
        // const mainnetVDot3Indexer = new VDot3Indexer(
        //     RenVMInstances.MainnetVDot3,
        //     connection,
        //     mainnetSync
        // );
        // mainnetVDot3Indexer.start().catch(CRASH);
    };

    if (initialize) {
        readFile("src/indexer/final.json", "utf-8", (err, data) => {
            if (err) {
                console.error(err);
                return;
            }

            const eventArray = JSON.parse(data) as Web3Event[];
            const eventList = List(eventArray).sortBy(
                (event) => event.timestamp
            );

            processEvents(eventList).then(startIndexers);
        });
    } else {
        startIndexers();
    }

    return {
        // [testnetVDot2Indexer.instance]: testnetVDot2Indexer,
        // [mainnetVDot2Indexer.instance]: mainnetVDot2Indexer,
        // [testnetVDot3Indexer.instance]: testnetVDot3Indexer,
        // [mainnetVDot3Indexer.instance]: mainnetVDot3Indexer,
    };
};
