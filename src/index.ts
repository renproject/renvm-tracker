import { resetDatabase, runDatabase } from "./database/database";
import { RenVMInstances } from "./database/models/RenVMInstance";
import {
    NETWORK,
    SERVER_DISABLED,
    TRACKER_DISABLED,
} from "./environmentVariables";
import { runServer } from "./graphql/server";
import { CRASH } from "./utils";
import { runTracker } from "./tracker";

// TODO: Remove once stable.
const RESET_DATABASE: boolean = false;

/**
 * Main program function. It runs the following steps:
 * (1) Connects to the database.
 * (2) Runs the block watcher and block handler.
 * (3) Runs the GraphQL server.
 */
export const main = async (
    network: RenVMInstances.Mainnet | RenVMInstances.Testnet
) => {
    console.log(`Network: ${network}`);

    if (RESET_DATABASE) {
        await resetDatabase();
        return;
    }

    // Connect to the database.
    const { connection, initialize } = await runDatabase(network);

    if (!TRACKER_DISABLED) {
        // Run the block watcher and block handler.
        await runTracker(network, connection, initialize);
    }

    if (!SERVER_DISABLED) {
        // Run the GraphQL server.
        runServer().catch(CRASH);
    }
};

main(NETWORK).catch(CRASH);
