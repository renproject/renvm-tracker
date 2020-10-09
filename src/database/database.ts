import { createConnection } from "typeorm";

import { typeOrmConfig } from "./connection";
import { Asset, Chain, FilecoinNetwork, FilecoinTransaction } from "./models";

export const insertMockData = async () => {
    // Chains

    const filecoinTestnet = new Chain("Filecoin", FilecoinNetwork.Testnet);
    await filecoinTestnet.save();

    // Assets

    const fil = new Asset(filecoinTestnet);
    fil.name = "FIL";
    await fil.save();
};

export const runDatabase = async () => {
    // await createConnection(typeOrmConfig);
    const connection = await createConnection(typeOrmConfig);
    // await connection.dropDatabase();
    await connection.showMigrations();
    await connection.runMigrations();
    await connection.synchronize();

    // await insertMockData();
};
