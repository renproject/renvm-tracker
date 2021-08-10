import dotenv from "dotenv";
import { RenNetwork } from "../networks";

dotenv.config();

export const NETWORK: RenNetwork.Mainnet | RenNetwork.Testnet =
    (process.env.NETWORK as RenNetwork.Mainnet | RenNetwork.Testnet) ||
    RenNetwork.Mainnet;

export const DEBUG = process.env.DEBUG || false;

// Database
export const DATABASE_URL = process.env.DATABASE_URL || "";

// Server
export const PORT = process.env.PORT || 4000;

export const TRACKER_DISABLED = process.env.TRACKER_DISABLED || false;
export const SERVER_DISABLED = process.env.SERVER_DISABLED || false;

export const GRAPHQL_PATH = "/";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const DEFAULT_PLAYGROUND_URL = IS_PRODUCTION
    ? NETWORK === RenNetwork.Mainnet
        ? `https://stats.renproject.io${GRAPHQL_PATH}`
        : `https://stats-testnet.renproject.io${GRAPHQL_PATH}`
    : `http://localhost:${PORT}${GRAPHQL_PATH}`;
