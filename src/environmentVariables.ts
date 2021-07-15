import { RenVMInstances } from "./database/models/RenVMInstance";

export const NETWORK: RenVMInstances.Mainnet | RenVMInstances.Testnet =
    (process.env.NETWORK as RenVMInstances.Mainnet | RenVMInstances.Testnet) ||
    RenVMInstances.Mainnet;

export const DEBUG = process.env.DEBUG || false;
