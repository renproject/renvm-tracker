import { readFile } from "fs/promises";
import { List } from "immutable";
import { Connection } from "typeorm";

import { CRASH } from "../util/utils";
import { BlockHandler } from "./blockHandler/blockHandler";
import {
    INPUT_FILE,
    syncHistoricEventsToDatabase,
    Web3Event,
} from "./historic/syncHistoricEventsToDatabase";
import { BlockWatcher } from "./blockWatcher/blockWatcher";
import { RenNetwork } from "../networks";

export const runTracker = async (
    network: RenNetwork.Mainnet | RenNetwork.Testnet,
    connection: Connection,
    initialize: boolean
) => {
    // Checks if it needs to load the historic events into the database.
    if (initialize) {
        const finalData = await readFile(INPUT_FILE, "utf-8");
        const eventArray = JSON.parse(finalData) as Web3Event[];
        const eventList = List(eventArray).sortBy((event) => event.timestamp);

        await syncHistoricEventsToDatabase(eventList);
    }

    // Start the block watcher and subscribe the block handler to block events.
    const blockHandler = new BlockHandler(network, connection);
    const blockWatcher = new BlockWatcher(network, connection);
    blockWatcher.subscribe("block", blockHandler.blockHandler);
    blockWatcher.start().catch(CRASH);
};
