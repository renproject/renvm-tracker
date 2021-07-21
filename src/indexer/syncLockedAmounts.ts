import {
    addLocked,
    addVolume,
    getTimeBlock,
    getTimestamp,
    RenVMInstances,
    subtractLocked,
    TimeBlock,
} from "../database/models";
import { applyPrice, getTokenPrice } from "./PriceFetcher";
import moment from "moment";
import BigNumber from "bignumber.js";
import { List } from "immutable";
import {
    Avalanche,
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Polygon,
} from "@renproject/chains-ethereum";
import { Solana } from "@renproject/chains";
import { MintChain, RenNetwork } from "@renproject/interfaces";
import { NETWORK } from "../environmentVariables";
import { resolveNetwork } from "@renproject/chains-solana/build/main/networks";
import { Connection } from "@solana/web3.js";
import Web3 from "web3";

const INFURA_KEY = process.env.INFURA_KEY;

if (!INFURA_KEY) {
    throw new Error(`Must set INFURA_KEY environment variable.`);
}

/**
 * When switching from chain-based tracking to RenVM tracking, there may be
 * some mints that were missed because they were initiated before the switch,
 * but submitted after it. This script should be run manually to bring the
 * database's locked amounts in sync with the chain's actual locked amount.
 */
export const syncLockedAmounts = async () => {
    const assets = ["BTC", "ZEC", "BCH", "FIL", "DGB", "DOGE", "LUNA"];

    const lockChains = [
        Ethereum,
        BinanceSmartChain,
        Fantom,
        Polygon,
        Avalanche,
        Solana,
    ];

    for (const Chain of lockChains) {
        let chain: MintChain;

        if (Chain === Solana) {
            const networkObject = resolveNetwork(NETWORK);

            const connection = new Connection(networkObject.endpoint);
            const provider = {
                connection,
                wallet: undefined as any,
            };

            chain = await new Chain(provider, networkObject).initialize(
                NETWORK
            );
        } else {
            const EVMChain = Chain as unknown as typeof Ethereum;
            const renNetwork = NETWORK as string as RenNetwork;
            const renNetworkAlt =
                renNetwork === RenNetwork.Mainnet
                    ? RenNetwork.MainnetVDot3
                    : renNetwork === RenNetwork.Testnet
                    ? RenNetwork.TestnetVDot3
                    : undefined;

            const networkObject =
                EVMChain.configMap[renNetwork] ||
                (renNetworkAlt ? EVMChain.configMap[renNetworkAlt] : undefined);

            if (!networkObject) {
                throw new Error(
                    `No config for ${EVMChain.chain} on network ${renNetwork}`
                );
            }

            const publicNode = networkObject.publicProvider({
                infura: INFURA_KEY,
            });
            const web3 = new Web3(publicNode);

            const chainObject = new EVMChain(
                web3.currentProvider as any,
                networkObject
            );
        }
    }
};
