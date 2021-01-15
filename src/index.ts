import { runDatabase } from "./database/database";
import { runIndexer } from "./indexer/indexer";
import { runServer } from "./server/server";
import { CRASH } from "./utils";

/**
 * Main program function.
 */
export const main = async (..._args: string[]) => {
    const connection = await runDatabase();

    const indexers = runIndexer(connection);
    runServer(indexers).catch(CRASH);
};

main(...process.argv)
    .then((ret) => ((ret as any) ? console.log(ret) : null))
    .catch(console.error);
