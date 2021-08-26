import "reflect-metadata";

import { ApolloServer } from "apollo-server-express";
import express from "express";
import { buildSchema } from "type-graphql";
import cors from "cors";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import compression from "compression";

import {
    DEFAULT_PLAYGROUND_URL,
    GRAPHQL_PATH,
    NETWORK,
    PORT,
} from "../common/environmentVariables";
import { Resolvers } from "./schema/Resolvers";

export const runServer = async () => {
    const schema = await buildSchema({
        resolvers: [Resolvers],
    });

    const apolloServer = new ApolloServer({
        schema,
        introspection: true,
        plugins: [
            // @ts-expect-error
            ApolloServerPluginLandingPageGraphQLPlayground({
                tabs: [
                    {
                        endpoint: DEFAULT_PLAYGROUND_URL,
                        query: `# This server provides a GraphQL API for querying RenVM${
                            NETWORK === "testnet" ? " (testnet)" : ""
                        } volume and stats.
# See docs at https://renproject.github.io/ren-client-docs/stats/renvm-stats
                        
{
  snapshot1: Snapshot(timestamp: "latest") {
    timestamp
    timestampString
    locked {
      asset
      chain
      amount
      amountInUsd
    }
    volume {
      asset
      chain
      amount
      amountInUsd
    }
    # Only available for Snapshots from August 2021 onwards.
    fees {
      asset
      amount
      amountInUsd
    }
    prices {
      asset
      decimals
      priceInUsd
    }
  }
}`,
                    },
                ],
            }),
        ],
    });
    await apolloServer.start();

    const app = express();

    // Enable plugins.
    app.use(cors());
    app.use(compression());

    apolloServer.applyMiddleware({ app, path: GRAPHQL_PATH });

    await new Promise<void>((resolve) => app.listen({ port: PORT }, resolve));

    console.log(`Server ready at ${DEFAULT_PLAYGROUND_URL}`);
};
