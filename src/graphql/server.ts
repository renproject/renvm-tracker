import "reflect-metadata";

import { ApolloServer } from "apollo-server-express";
import express from "express";
import { buildSchema } from "type-graphql";
import cors from "cors";

import { PORT } from "../common/environmentVariables";
import { Resolvers } from "./schema/Resolvers";

export const runServer = async () => {
    const schema = await buildSchema({
        resolvers: [Resolvers],
    });

    const apolloServer = new ApolloServer({ schema });
    await apolloServer.start();

    const app = express();

    // Enable cors.
    app.use(cors());

    apolloServer.applyMiddleware({ app, path: "/" });

    await new Promise<void>((resolve) => app.listen({ port: PORT }, resolve));

    console.log(
        `Server ready at http://localhost:${PORT}${apolloServer.graphqlPath}`
    );
};
