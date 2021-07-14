import { resetDatabase, runDatabase } from "./database/database";
import { RenVMInstances } from "./database/models/RenVMInstance";
import { NETWORK } from "./environmentVariables";
import { runIndexer } from "./indexer/indexer";
import { runServer } from "./server/server";
import { CRASH } from "./utils";

/**
 * Main program function.
 */
export const main = async (
    network: RenVMInstances.Mainnet | RenVMInstances.Testnet
) => {
    console.log(`Network: ${network}`);

    // await resetDatabase(network);
    // return;

    const { connection, initialize } = await runDatabase(network);

    const indexers = await runIndexer(connection, initialize, network);
    runServer(indexers).catch(CRASH);
};

main(NETWORK)
    .then((ret) => ((ret as any) ? console.log(ret) : null))
    .catch(console.error);
