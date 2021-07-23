import { RenVMInstances } from "./database/models/RenVMInstance";

import dotenv from "dotenv";

dotenv.config();

export const NETWORK: RenVMInstances.Mainnet | RenVMInstances.Testnet =
    (process.env.NETWORK as RenVMInstances.Mainnet | RenVMInstances.Testnet) ||
    RenVMInstances.Mainnet;

export const DEBUG = process.env.DEBUG || false;

// Database
export const DATABASE_URL = process.env.DATABASE_URL || "";

// Server
export const PORT = process.env.PORT || 4000;
