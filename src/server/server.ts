import "reflect-metadata";

import { ApolloServer } from "apollo-server-express";
import express from "express";
import { buildSchema } from "type-graphql";
import cors from "cors";

import { PORT } from "../env";
import { Indexers } from "../indexer/indexer";
import { Resolvers } from "./schema/Resolvers";

export const runServer = async (_indexers: Indexers) => {
    const schema = await buildSchema({
        resolvers: [Resolvers],
    });

    const apolloServer = new ApolloServer({ schema });
    const app = express();

    // Enable cors.
    app.use(cors());

    apolloServer.applyMiddleware({ app });

    app.listen(PORT, () => console.log(`Server started on port ${PORT}.`));
};
