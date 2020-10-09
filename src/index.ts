import { runDatabase } from "./database/database";
import { runIndexer } from "./indexer/indexer";
import { runServer } from "./server/server";
import { CRASH } from "./utils";

/**
 * Main program function.
 */
export const main = async (..._args: string[]) => {
    await runDatabase();

    const indexers = runIndexer();
    runServer(indexers).catch(CRASH);
};

main(...process.argv)
    .then(console.log)
    .catch(console.error);
