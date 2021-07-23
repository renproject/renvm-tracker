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
