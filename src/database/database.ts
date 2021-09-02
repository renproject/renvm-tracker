import { Connection, createConnection, getConnection } from "typeorm";

import { typeOrmConfig } from "./connection";
import { RenVMProgress } from "./models";
import { RenNetwork } from "../networks";
import { networkConfigs } from "../tracker/historic/config";
import { SECONDS, sleep } from "../common/utils";

export const initializeDatabase = async (
    network: RenNetwork.Mainnet | RenNetwork.Testnet
) => {
    console.log(`Initializing database...`);

    const renVM = new RenVMProgress();
    renVM.syncedBlock = networkConfigs[network].liveRenVM.fromBlock;
    await renVM.save();

    await sleep(1 * SECONDS);
};

export const runDatabase = async (
    NETWORK: RenNetwork.Mainnet | RenNetwork.Testnet
): Promise<{
    connection: Connection;
    initialize: boolean;
}> => {
    console.info(`Connecting to database...`);

    const connection = await createConnection(typeOrmConfig);

    // await connection.dropDatabase();
    await connection.showMigrations();
    await connection.runMigrations();
    await connection.synchronize();

    let initialize = false;
    try {
        const renVM = await RenVMProgress.findOneOrFail();
        if (!renVM.initialized) {
            // Initialization failed. Reset database and start again.
            console.log("Previous session's initialization process failed.");
            await resetDatabase(connection);
            await connection.showMigrations();
            await connection.runMigrations();
            await connection.synchronize();
            initialize = true;
        }
    } catch (error) {
        console.error(error);
        initialize = true;
    }

    if (initialize) {
        await initializeDatabase(NETWORK);
    }

    console.info("Connected.");

    return { connection, initialize };
};

export const resetDatabase = async (connection?: Connection) => {
    console.info(`Resetting database...`);

    try {
        connection = connection || (await createConnection(typeOrmConfig));
    } catch (error) {
        if (/AlreadyHasActiveConnectionError/.exec(error.message)) {
            // Use existing connection.
            connection = await getConnection();
        } else {
            throw error;
        }
    }
    await connection.dropDatabase();
};
