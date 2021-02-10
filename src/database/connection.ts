import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { DATABASE_URL } from "../env";
import { RenVMInstance, TimeBlock } from "./models";
import { TimeBlockV2 } from "./models/TimeBlockV2";

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
    entities: [TimeBlock, TimeBlockV2, RenVMInstance],
};
