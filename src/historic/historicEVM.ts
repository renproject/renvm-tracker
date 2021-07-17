import Web3 from "web3";
import { PastLogsOptions, Log } from "web3-core";
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
import { HistoricEvent } from "./types";
import { config } from "dotenv";
import { writeFile } from "fs";
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
    gateways: Array<
        [
            // Symbol
            string,
            // Block height of ERC20 deployment
            number
        ]
    >;
}

export const ethereum: EVMNetwork = {
    chainClass: Ethereum,
    gateways: [
        ["BTC", 9736969],
        ["ZEC", 9737148],
        ["BCH", 9737199],
        ["FIL", 11156141],
        ["DGB", 11182416],
        ["DOGE", 11182446],
        ["LUNA", 11182591],
    ],
};

export const binanceSmartChain: EVMNetwork = {
    chainClass: BinanceSmartChain,
    gateways: [
        ["BTC", 2132296],
        ["ZEC", 2132695],
        ["BCH", 2133070],
        ["FIL", 1929542],
        ["DGB", 1929878],
        ["DOGE", 1930163],
        ["LUNA", 1930566],
    ],
};

export const fantom: EVMNetwork = {
    chainClass: Fantom,
    gateways: [
        ["BTC", 7497610],
        ["ZEC", 7501989],
        ["BCH", 7502280],
        ["FIL", 7502575],
        ["DGB", 7502840],
        ["DOGE", 7503104],
        ["LUNA", 7503383],
    ],
};

export const polygon: EVMNetwork = {
    chainClass: Polygon,
    gateways: [
        ["BTC", 14937166],
        ["ZEC", 14937213],
        ["BCH", 14937654],
        ["FIL", 14937702],
        ["DGB", 14937749],
        ["DOGE", 14937797],
        ["LUNA", 14937845],
    ],
};

export const avalanche: EVMNetwork = {
    chainClass: Avalanche,
    gateways: [
        ["BTC", 2177340],
        ["ZEC", 2177423],
        ["BCH", 2177453],
        ["FIL", 2177489],
        ["DGB", 2177519],
        ["DOGE", 2177557],
        ["LUNA", 2177598],
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
        let currentTimestamp = parseInt(
            (await web3.eth.getBlock(currentBlock)).timestamp.toString(),
            10
        );
        let nextTimestamp = parseInt(
            (await web3.eth.getBlock(currentBlock + 1)).timestamp.toString(),
            10
        );

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

    const to = await getBlockBeforeTimestamp(web3, timestamp);

    console.info(`Fetching events up until ${to}.`);

    const blocksToEstimateBlocktime = 1000;
    const toTimestamp = new BigNumber(
        (await web3.eth.getBlock(to)).timestamp
    ).toNumber();
    const timestampNBlocksAgo = new BigNumber(
        (await web3.eth.getBlock(to - blocksToEstimateBlocktime)).timestamp
    ).toNumber();
    const blockTime =
        (toTimestamp - timestampNBlocksAgo) / blocksToEstimateBlocktime;

    console.info(`Estimating block time as ${blockTime}s.`);

    let total = new BigNumber(0);

    for (const [symbol, deployedAtBlock] of gateways) {
        const tokenContract = await chainObject.getTokenContractAddress(symbol);

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
                        address: tokenContract,
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
                const mint = {
                    network: renNetwork,
                    chain: chainObject.chain,
                    symbol,
                    timestamp: Math.floor(
                        toTimestamp - (to - log.blockNumber) * blockTime
                    ),
                    amount: new BigNumber(log.data).toFixed(),
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
                        address: tokenContract,
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
                const burn = {
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
