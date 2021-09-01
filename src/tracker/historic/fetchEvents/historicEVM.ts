import Web3 from "web3";
import { List } from "immutable";
import BigNumber from "bignumber.js";
import {
    BinanceSmartChain,
    Ethereum,
    Fantom,
    Polygon,
    Avalanche,
    EthereumBaseChain,
} from "@renproject/chains-ethereum";
import { green } from "chalk";
import { RenNetwork } from "@renproject/interfaces";
import { config } from "dotenv";
import { writeFile } from "fs";
import { HistoricEvent } from "../types";
import { SECONDS, sleep } from "../../../common/utils";

config();

// If more than 10000 events are in any set of 250k logs, then this should be
// decreased.
const defaultSkip = 250000;

const INFURA_KEY = process.env.INFURA_KEY;

if (!INFURA_KEY) {
    throw new Error(`Must set INFURA_KEY environment variable.`);
}

interface EVMNetwork {
    chainClass: typeof EthereumBaseChain;
    gateways: Array<{
        // Symbol
        symbol: string;
        // Block height of ERC20 deployment
        fromBlock: {
            [network: string]: number | null;
        };
    }>;
}

export const ethereum: EVMNetwork = {
    chainClass: Ethereum,
    gateways: [
        {
            symbol: "BTC",
            fromBlock: {
                [RenNetwork.Mainnet]: 9736969,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "ZEC",
            fromBlock: {
                [RenNetwork.Mainnet]: 9737148,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "BCH",
            fromBlock: {
                [RenNetwork.Mainnet]: 9737199,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "FIL",
            fromBlock: {
                [RenNetwork.Mainnet]: 11156141,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "DGB",
            fromBlock: {
                [RenNetwork.Mainnet]: 11182416,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "DOGE",
            fromBlock: {
                [RenNetwork.Mainnet]: 11182446,
                [RenNetwork.Testnet]: 17625998,
            },
        },
        {
            symbol: "LUNA",
            fromBlock: {
                [RenNetwork.Mainnet]: 11182591,
                [RenNetwork.Testnet]: 17625998,
            },
        },
    ],
};

export const binanceSmartChain: EVMNetwork = {
    chainClass: BinanceSmartChain,
    gateways: [
        {
            symbol: "BTC",
            fromBlock: {
                [RenNetwork.Mainnet]: 2132296,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "ZEC",
            fromBlock: {
                [RenNetwork.Mainnet]: 2132695,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "BCH",
            fromBlock: {
                [RenNetwork.Mainnet]: 2133070,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "FIL",
            fromBlock: {
                [RenNetwork.Mainnet]: 1929542,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "DGB",
            fromBlock: {
                [RenNetwork.Mainnet]: 1929878,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "DOGE",
            fromBlock: {
                [RenNetwork.Mainnet]: 1930163,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "LUNA",
            fromBlock: {
                [RenNetwork.Mainnet]: 1930566,
                [RenNetwork.Testnet]: null,
            },
        },
    ],
};

export const fantom: EVMNetwork = {
    chainClass: Fantom,
    gateways: [
        {
            symbol: "BTC",
            fromBlock: {
                [RenNetwork.Mainnet]: 7497610,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "ZEC",
            fromBlock: {
                [RenNetwork.Mainnet]: 7501989,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "BCH",
            fromBlock: {
                [RenNetwork.Mainnet]: 7502280,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "FIL",
            fromBlock: {
                [RenNetwork.Mainnet]: 7502575,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "DGB",
            fromBlock: {
                [RenNetwork.Mainnet]: 7502840,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "DOGE",
            fromBlock: {
                [RenNetwork.Mainnet]: 7503104,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "LUNA",
            fromBlock: {
                [RenNetwork.Mainnet]: 7503383,
                [RenNetwork.Testnet]: 0,
            },
        },
    ],
};

export const polygon: EVMNetwork = {
    chainClass: Polygon,
    gateways: [
        {
            symbol: "BTC",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937166,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "ZEC",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937213,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "BCH",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937654,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "FIL",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937702,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "DGB",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937749,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "DOGE",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937797,
                [RenNetwork.Testnet]: null,
            },
        },
        {
            symbol: "LUNA",
            fromBlock: {
                [RenNetwork.Mainnet]: 14937845,
                [RenNetwork.Testnet]: null,
            },
        },
    ],
};

export const avalanche: EVMNetwork = {
    chainClass: Avalanche,
    gateways: [
        {
            symbol: "BTC",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177340,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "ZEC",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177423,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "BCH",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177453,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "FIL",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177489,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "DGB",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177519,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "DOGE",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177557,
                [RenNetwork.Testnet]: 0,
            },
        },
        {
            symbol: "LUNA",
            fromBlock: {
                [RenNetwork.Mainnet]: 2177598,
                [RenNetwork.Testnet]: 0,
            },
        },
    ],
};

const getBlockBeforeTimestamp = async (web3: Web3, timestamp: number) => {
    let earliestBlockNumber = 0;
    let latestBlockNumber = await web3.eth.getBlockNumber();

    let count = 0;

    while (true) {
        count++;
        let currentBlock = Math.floor(
            (latestBlockNumber - earliestBlockNumber) / 2 + earliestBlockNumber
        );
        console.info(
            `#${count}`,
            [earliestBlockNumber, currentBlock, latestBlockNumber],
            `(Max remaining: ${Math.ceil(
                Math.log2(latestBlockNumber - earliestBlockNumber)
            )})`
        );
        let currentTimestamp;
        let nextTimestamp;
        while (true) {
            try {
                currentTimestamp = parseInt(
                    (
                        await web3.eth.getBlock(currentBlock)
                    ).timestamp.toString(),
                    10
                );
                nextTimestamp = parseInt(
                    (
                        await web3.eth.getBlock(currentBlock + 1)
                    ).timestamp.toString(),
                    10
                );
                break;
            } catch (error) {
                console.log("Retrying in 10 seconds...");
                await sleep(10 * SECONDS);
            }
        }

        if (currentTimestamp <= timestamp && nextTimestamp > timestamp) {
            return currentBlock;
        } else if (currentTimestamp < timestamp) {
            earliestBlockNumber = currentBlock;
        } else {
            latestBlockNumber = currentBlock;
        }
    }
};

export const getHistoricEVMEvents = async (
    timestamp: number,
    evmNetwork: EVMNetwork,
    renNetwork: RenNetwork,
    finalFile: string
): Promise<List<HistoricEvent>> => {
    let eventArray = List();
    let { chainClass, gateways } = evmNetwork;

    const renNetworkAlt =
        renNetwork === RenNetwork.Mainnet
            ? RenNetwork.MainnetVDot3
            : renNetwork === RenNetwork.Testnet
            ? RenNetwork.TestnetVDot3
            : undefined;

    const networkObject =
        chainClass.configMap[renNetwork] ||
        (renNetworkAlt ? chainClass.configMap[renNetworkAlt] : undefined);

    if (!networkObject) {
        throw new Error(
            `No config for ${chainClass.chain} on network ${renNetwork}`
        );
    }

    // const publicNode =
    //     chainClass.chain === "Polygon" && !networkObject.isTestnet
    //         ? "https://multichain.renproject.io/mainnet/polygon"
    //         : chainClass.chain === "BinanceSmartChain" &&
    //           !networkObject.isTestnet
    //         ? "https://multichain.renproject.io/mainnet/bsc"
    const publicNode = networkObject.publicProvider({ infura: INFURA_KEY });
    const web3 = new Web3(publicNode);

    const chainObject = new chainClass(
        web3.currentProvider as any,
        networkObject
    );

    let skip = chainObject.logRequestLimit || defaultSkip;
    // chainClass.chain === "Polygon"
    //     ? 25000
    //     : chainClass.chain === "BinanceSmartChain"
    //     ? 25000
    //     : 250000; // chainObject.logRequestLimit || defaultSkip;

    console.log(
        `Handling ${evmNetwork.chainClass.chain} (log batch size: ${skip} logs)`
    );

    console.info(
        `Finding ${chainObject.chain} block with timestamp <= ${timestamp}.`
    );

    // const deployedAtBlock = await getBlockBeforeTimestamp(web3, timestamp);

    let to;
    let toTimestamp;
    let blockTime;

    while (true) {
        try {
            to = await getBlockBeforeTimestamp(web3, timestamp);

            console.info(`Fetching events up until ${to}.`);

            const blocksToEstimateBlocktime = 1000;
            toTimestamp = new BigNumber(
                (await web3.eth.getBlock(to)).timestamp
            ).toNumber();
            const timestampNBlocksAgo = new BigNumber(
                (
                    await web3.eth.getBlock(to - blocksToEstimateBlocktime)
                ).timestamp
            ).toNumber();
            blockTime =
                (toTimestamp - timestampNBlocksAgo) / blocksToEstimateBlocktime;
            break;
        } catch (error) {
            console.log("Retrying in 10 seconds...");
            await sleep(10 * SECONDS);
        }
    }

    console.info(`Estimating block time as ${blockTime}s.`);

    let total = new BigNumber(0);

    for (const { symbol, fromBlock } of gateways) {
        const assetContract = await chainObject.getTokenContractAddress(symbol);
        const deployedAtBlock = fromBlock[renNetwork];

        if (deployedAtBlock === null) {
            continue;
        }

        for (let i = deployedAtBlock; i < to; i += skip) {
            console.info(
                `(Progress for ${symbol} on ${chainObject.chain}: ${green(
                    Math.floor(100 - ((to - i) / (to - deployedAtBlock)) * 100)
                )}%) (${i} to ${Math.min(i + skip, to)})`
            );

            let mintLogs;
            while (true) {
                try {
                    mintLogs = await web3.eth.getPastLogs({
                        address: assetContract,
                        fromBlock: i,
                        toBlock: Math.min(i + skip, to),
                        topics: [
                            web3.utils.keccak256(
                                "Transfer(address,address,uint256)"
                            ),
                            "0x0000000000000000000000000000000000000000000000000000000000000000",
                        ],
                    });
                    break;
                } catch (error) {
                    console.error(error);
                    if (
                        String(error && error.message).match(
                            /504 Gateway Time-out/
                        )
                    ) {
                        console.log(
                            `Decreasing skip from ${skip} to ${skip / 2}.`
                        );
                        // Decrease how many logs are fetched.
                        skip = skip / 2;
                    }
                }
            }

            for (const log of mintLogs) {
                const mint: HistoricEvent = {
                    network: renNetwork,
                    chain: chainObject.chain,
                    symbol,
                    timestamp: Math.floor(
                        toTimestamp - (to - log.blockNumber) * blockTime
                    ),
                    amount: new BigNumber(log.data).toFixed(),
                    txHash: log.transactionHash,
                    to: ("0x" + log.topics[2].slice(2 + 24)).toLowerCase(),
                };

                eventArray = eventArray.push(mint);

                if (symbol === "BTC") {
                    total = total.plus(mint.amount);
                }
            }

            let burnLogs;
            while (true) {
                try {
                    burnLogs = await web3.eth.getPastLogs({
                        address: assetContract,
                        fromBlock: i,
                        toBlock: Math.min(i + skip, to),
                        topics: [
                            // web3.utils.keccak256(
                            //     "LogBurn(bytes,uint256,uint256,bytes)"
                            // ),
                            web3.utils.keccak256(
                                "Transfer(address,address,uint256)"
                            ),
                            null,
                            "0x0000000000000000000000000000000000000000000000000000000000000000",
                        ],
                    });
                    break;
                } catch (error) {
                    console.error(error);
                    if (
                        String(error && error.message).match(
                            /504 Gateway Time-out/
                        )
                    ) {
                        console.log(
                            `Decreasing skip from ${skip} to ${skip / 2}.`
                        );
                        // Decrease how many logs are fetched.
                        skip = skip / 2;
                    }
                }
            }

            for (const log of burnLogs) {
                const burn: HistoricEvent = {
                    network: renNetwork,
                    chain: chainObject.chain,
                    symbol,
                    timestamp: Math.floor(
                        toTimestamp - (to - log.blockNumber) * blockTime
                    ),
                    amount: new BigNumber(
                        // "0x" + log.data.slice(64 + 2, 128 + 2)
                        log.data
                    )
                        .negated()
                        .toFixed(),
                    txHash: log.transactionHash,
                    to: ("0x" + log.topics[2].slice(2 + 24)).toLowerCase(),
                };

                eventArray = eventArray.push(burn);

                if (symbol === "BTC") {
                    total = total.plus(burn.amount);
                }
            }

            if (mintLogs.length && burnLogs.length) {
                console.log(
                    `Found ${green(mintLogs.length)} mints and ${green(
                        burnLogs.length
                    )} burns.`
                );
            } else if (mintLogs.length) {
                console.log(`Found ${green(mintLogs.length)} mints.`);
            } else if (burnLogs.length) {
                console.log(`Found ${green(burnLogs.length)} burns.`);
            }
        }
    }

    eventArray = eventArray.sort((event) => event.timestamp);

    console.info(
        `Processed ${eventArray.size} trades. Sum of BTC locked on ${
            chainObject.chain
        }: ${total.dividedBy(new BigNumber(10).exponentiatedBy(8))}`
    );

    const fileString = JSON.stringify(eventArray.toJSON());

    console.info(
        `Writing ${eventArray.size} events to ${
            finalFile + "-" + chainObject.name
        }...`
    );

    // write file to disk
    writeFile(finalFile + chainObject.name, fileString, "utf8", (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`Done! Wrote ${eventArray.size} events.`);
        }
    });

    return eventArray;
};
