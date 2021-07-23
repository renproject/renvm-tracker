import { readFile } from "fs/promises";
import { List } from "immutable";
import { resetDatabase, runDatabase } from "./database/database";
import { RenVMInstances } from "./database/models/RenVMInstance";
import { NETWORK } from "./environmentVariables";
import {
    INPUT_FILE,
    syncHistoricEventsToDatabase,
    Web3Event,
} from "./tracker/historic/syncHistoricEventsToDatabase";
import { BlockWatcher } from "./tracker/blockWatcher/blockWatcher";
import { BlockHandler } from "./tracker/blockHandler/blockHandler";
import { runServer } from "./graphql/server";
import { CRASH } from "./utils";

// TODO: Remove once stable.
const RESET_DATABASE: boolean = false;

/**
 * Main program function.
 */
export const main = async (
    network: RenVMInstances.Mainnet | RenVMInstances.Testnet
) => {
    console.log(`Network: ${network}`);

    if (RESET_DATABASE) {
        await resetDatabase(network);
        return;
    }

    const { connection, initialize } = await runDatabase(network);

    // Write historic events to database.
    if (initialize) {
        const finalData = await readFile(INPUT_FILE, "utf-8");
        const eventArray = JSON.parse(finalData) as Web3Event[];
        const eventList = List(eventArray).sortBy((event) => event.timestamp);

        await syncHistoricEventsToDatabase(eventList);
    }

    // Start block watcher and add blockHandler.
    const blockHandler = new BlockHandler(
        network === "testnet" ? RenVMInstances.Testnet : RenVMInstances.Mainnet,
        connection
    );
    const blockWatcher = new BlockWatcher(
        network === "testnet" ? RenVMInstances.Testnet : RenVMInstances.Mainnet,
        connection
    );
    blockWatcher.subscribe("block", blockHandler.blockHandler);
    blockWatcher.start().catch(CRASH);

    runServer().catch(CRASH);
};

main(NETWORK)
    .then((ret) => ((ret as any) ? console.log(ret) : null))
    .catch(console.error);
