import dotenv from "dotenv";

dotenv.config();

// Database
export const DATABASE_URL = process.env.DATABASE_URL || "";

// Server
export const PORT = process.env.PORT || 4000;

// Filecoin
export const FILECOIN_TESTNET_URL = process.env.FILECOIN_TESTNET_URL || "";
export const FILECOIN_TESTNET_TOKEN = process.env.FILECOIN_TESTNET_TOKEN || "";

export const FILECOIN_MAINNET_URL = process.env.FILECOIN_MAINNET_URL || "";
export const FILECOIN_MAINNET_TOKEN = process.env.FILECOIN_MAINNET_TOKEN || "";
