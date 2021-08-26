import { ColumnCommonOptions } from "typeorm/decorator/options/ColumnCommonOptions";

export const JSONTransformer: ColumnCommonOptions = {
    transformer: {
        to: JSON.stringify,
        from: JSON.parse,
    },
};
