import "reflect-metadata";

import { ApolloServer } from "apollo-server-express";
import express from "express";
import { buildSchema } from "type-graphql";
import cors from "cors";

import { PORT } from "../util/environmentVariables";
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

    app.listen(PORT, () => console.log(`Server started on port ${PORT}.`));
    await new Promise<void>((resolve) => app.listen({ port: 4000 }, resolve));

    console.log(
        `Server ready at http://localhost:4000${apolloServer.graphqlPath}`
    );
};
