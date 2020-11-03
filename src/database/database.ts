import { Connection, createConnection, getConnection } from "typeorm";

import { typeOrmConfig } from "./connection";
import { Asset, Chain, FilecoinNetwork } from "./models";

export const initializeDatabase = async () => {
    // Chains

    const filecoinTestnet = new Chain("Filecoin", FilecoinNetwork.Testnet);
    await filecoinTestnet.save();

    const filecoinMainnet = new Chain("Filecoin", FilecoinNetwork.Mainnet);
    await filecoinMainnet.save();

    // Assets

    const tFil = new Asset(filecoinTestnet);
    tFil.name = "tFIL";
    await tFil.save();

    const fil = new Asset(filecoinMainnet);
    fil.name = "FIL";
    await fil.save();
};

export const runDatabase = async () => {
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

    // await initializeDatabase();
};
