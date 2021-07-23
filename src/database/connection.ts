import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { DATABASE_URL } from "../util/environmentVariables";
import { RenVM, Snapshot } from "./models";

export const typeOrmConfig: PostgresConnectionOptions = {
    type: "postgres",
    url: DATABASE_URL,
    ssl: true,
    extra: {
        ssl: {
            rejectUnauthorized: false,
        },
    },
    database: "indexer",
    synchronize: false,
    logging: false,
    entities: [Snapshot, RenVM],
};
