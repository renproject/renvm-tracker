// @ts-ignore
import FilecoinClient from "@glif/filecoin-rpc-client";

import { Asset } from "../database/models";
import {
    FilecoinNetwork,
    FilecoinTransaction,
} from "../database/models/FilecoinTransaction";
import {
    FILECOIN_MAINNET_TOKEN,
    FILECOIN_MAINNET_URL,
    FILECOIN_TESTNET_TOKEN,
    FILECOIN_TESTNET_URL,
} from "../env";
import { CYAN, RESET, SECONDS } from "../utils";
import { IndexerClass } from "./base";

type FilecoinClient = { request(method: string, ...args: any[]): Promise<any> };

// TODO: Use database to track addresses.
export const WATCHED_ADDRESSES = {
    [FilecoinNetwork.Mainnet]: "f15wjyn36z6x5ypq7f73yaolqbxyiiwkg5mmuyo2q",
    [FilecoinNetwork.Testnet]: "t1v2ftlxhedyoijv7uqgxfygiziaqz23lgkvks77i",
};

export class FilecoinIndexer extends IndexerClass<
    FilecoinClient,
    FilecoinNetwork
> {
    name = "Filecoin";

    constructor(network: FilecoinNetwork) {
        super(network);
    }

    async connect() {
        if (this.client) {
            return this.client;
        }

        let config;

        switch (this.network) {
            case FilecoinNetwork.Testnet:
                config = {
                    apiAddress: FILECOIN_TESTNET_URL,
                    token: FILECOIN_TESTNET_TOKEN,
                };
                break;
            case FilecoinNetwork.Mainnet:
                config = {
                    apiAddress: FILECOIN_MAINNET_URL,
                    token: FILECOIN_MAINNET_TOKEN,
                };
                break;
            default:
                throw new Error(`Unsupported Filecoin network ${this.network}`);
        }

        const client = new FilecoinClient(config);
        this.client = client;

        return client;
    }

    async loop(client: FilecoinClient) {
        const chainState = await this.readDatabase();

        const asset = await Asset.findOneOrFail({
            name: "FIL",
        });

        const latestHeight = await this.getLatestHeight();

        if (chainState.synced === 0) {
            console.log(
                `[${this.name.toLowerCase()}][${
                    this.network
                }] Starting indexer fom block ${CYAN}${latestHeight}${RESET}`
            );

            chainState.synced = latestHeight;
            await chainState.save();
        } else if (latestHeight > chainState.synced) {
            const synced = chainState.synced + 1 || latestHeight;

            console.log(
                `[${this.name.toLowerCase()}][${
                    this.network
                }] Syncing from ${CYAN}${
                    chainState.synced
                }${RESET} to ${CYAN}${latestHeight}${RESET}`
            );

            const latestTXs = await client.request(
                "StateListMessages",
                {
                    Version: 0,
                    To: WATCHED_ADDRESSES[this.network],
                    From: null,
                    Nonce: 0,
                    Value: "0",
                    GasPrice: "0",
                    GasLimit: 0,
                    Method: 0,
                    Params: null,
                },
                [],
                synced
            );

            if (latestTXs) {
                for (const cid of latestTXs) {
                    try {
                        const transactionDetails = await client.request(
                            "ChainGetMessage",
                            cid
                        );

                        if (this.network === FilecoinNetwork.Testnet) {
                            transactionDetails.To = transactionDetails.To.replace(
                                /^f/,
                                "t"
                            );
                            transactionDetails.From = transactionDetails.From.replace(
                                /^f/,
                                "t"
                            );
                        }
                        new FilecoinTransaction(chainState, asset, {
                            cid: cid["/"],
                            to: transactionDetails.To,
                            amount: transactionDetails.Value,
                            params: transactionDetails.Params,
                            blocknumber: latestHeight,
                            nonce: transactionDetails.Nonce,
                        }).save();

                        console.log(
                            `[${this.name.toLowerCase()}][${
                                this.network
                            }] Saved transaction:`,
                            transactionDetails
                        );
                    } catch (error) {
                        console.error(error);
                    }
                }
            }

            chainState.synced = latestHeight;
            await chainState.save();
        } else {
            console.log(
                `[${this.name.toLowerCase()}][${
                    this.network
                }] Already synced up to ${CYAN}${latestHeight}${RESET}`
            );
        }
    }

    async readTXFromDatabase(cid: string) {
        return await FilecoinTransaction.findOneOrFail({
            cid,
            network: this.network,
        });
    }

    lastFetchedHeight: { height: number; time: number } | null = null;
    async getLatestHeight(_client?: FilecoinClient): Promise<number> {
        // If the height was fetched within 10 seconds, return it.
        if (
            this.lastFetchedHeight &&
            Date.now() - this.lastFetchedHeight.time < 10 * SECONDS
        ) {
            return this.lastFetchedHeight.height;
        }

        // Fetch latest height.
        const client = _client || (await this.connect());
        const chainHead = await client.request("ChainHead");
        const height = chainHead.Height;

        // Store height.
        this.lastFetchedHeight = {
            height,
            time: Date.now(),
        };

        return height;
    }
}
