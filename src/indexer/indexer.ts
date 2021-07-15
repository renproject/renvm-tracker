import { Connection } from "typeorm";
import { RenVMInstances } from "../database/models";
import { CRASH } from "../utils";
import { IndexerClass } from "./base";
import { RenVMIndexer } from "./blockFetchers/renVM";
import { processEvents, Web3Event } from "./blockFetchers/web3";
import { readFile } from "fs";
import { List } from "immutable";

export interface Indexers {
    [instances: string]: IndexerClass<unknown>;
}

/**
 * runIndexer starts a loop for each chain's network.
 */
export const runIndexer = async (
    connection: Connection,
    initialize: boolean,
    network: RenVMInstances.Mainnet | RenVMInstances.Testnet
): Promise<Indexers> => {
    const startIndexers = () => {
        const renVMIndexer = new RenVMIndexer(
            network === "testnet"
                ? RenVMInstances.Testnet
                : RenVMInstances.Mainnet,
            connection
        );
        renVMIndexer.start().catch(CRASH);
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
        // v3: renVMIndexer,
    };
};
