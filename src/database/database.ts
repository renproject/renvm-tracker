import { Connection, createConnection, getConnection } from "typeorm";

import { typeOrmConfig } from "./connection";
import { RenNetwork, RenVMInstance, RenVMInstances } from "./models";

export const initializeDatabase = async (
    network: RenVMInstances.Mainnet | RenVMInstances.Testnet
) => {
    switch (network) {
        case RenVMInstances.Mainnet:
            const mainnet = new RenVMInstance(
                RenVMInstances.Mainnet,
                RenNetwork.Mainnet
            );
            mainnet.syncedBlock = 35897837;
            await mainnet.save();

            const mainnetVDot3 = new RenVMInstance(
                RenVMInstances.MainnetVDot3,
                RenNetwork.Mainnet
            );
            mainnetVDot3.syncedBlock = 665738;
            await mainnetVDot3.save();

            break;
        case RenVMInstances.Testnet:
            const testnet = new RenVMInstance(
                RenVMInstances.Testnet,
                RenNetwork.Testnet
            );
            testnet.syncedBlock = 2484310;
            await testnet.save();

            const testnetVDot3 = new RenVMInstance(
                RenVMInstances.TestnetVDot3,
                RenNetwork.Testnet
            );
            testnetVDot3.syncedBlock = 714167;
            await testnetVDot3.save();

            break;
    }
};

export const runDatabase = async (
    NETWORK: RenVMInstances.Mainnet | RenVMInstances.Testnet
): Promise<{
    connection: Connection;
    initialize: boolean;
}> => {
    console.log(`Connecting to database...`);

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
    // await connection.dropDatabase();
    await connection.showMigrations();
    await connection.runMigrations();
    await connection.synchronize();

    let initialize = false;
    try {
        await initializeDatabase(NETWORK);
        initialize = true;
    } catch (error) {
        // Ignore
        console.error(error);
    }

    console.log("Connected.");

    return { connection, initialize };
};
