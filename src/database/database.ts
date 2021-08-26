import { Connection, createConnection, getConnection } from "typeorm";

import { typeOrmConfig } from "./connection";
import { RenVMProgress } from "./models";
import { RenNetwork } from "../networks";

export const initializeDatabase = async (
    network: RenNetwork.Mainnet | RenNetwork.Testnet
) => {
    const renVM = new RenVMProgress();

    switch (network) {
        case RenNetwork.Mainnet:
            renVM.syncedBlock = 96566;
            await renVM.save();

            break;
        case RenNetwork.Testnet:
            const renVM = new RenVMProgress();
            renVM.syncedBlock = 104;
            await renVM.save();

            break;
    }
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
        await initializeDatabase(NETWORK);
        initialize = true;
    } catch (error) {
        console.error(error);
    }

    console.info("Connected.");

    return { connection, initialize };
};

export const resetDatabase = async () => {
    console.info(`Resetting database...`);

    let connection: Connection;
    try {
        connection = await createConnection(typeOrmConfig);
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
