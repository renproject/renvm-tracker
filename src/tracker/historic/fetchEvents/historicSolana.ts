import { Solana, SolanaClass } from "@renproject/chains-solana";
import { RenNetwork } from "@renproject/interfaces";
import { List } from "immutable";
import { HistoricEvent } from "../types";
import { resolveNetwork } from "@renproject/chains-solana/build/main/networks";
import { ConfirmedSignatureInfo, Connection, PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { green, red } from "chalk";

interface SolanaNetwork {
    chainClass: typeof SolanaClass;
    gateways: string[];
}

export const solana: SolanaNetwork = {
    chainClass: Solana,
    gateways: ["BTC", "ZEC", "BCH", "FIL", "DGB", "DOGE", "LUNA"],
};

export const getHistoricSolanaEvents = async (
    timestamp: number,
    evmNetwork: SolanaNetwork,
    renNetwork: RenNetwork
): Promise<List<HistoricEvent>> => {
    let eventArray = List<HistoricEvent>();
    let { chainClass, gateways } = evmNetwork;

    const networkObject = resolveNetwork(renNetwork);

    const connection = new Connection(networkObject.endpoint);
    const provider = {
        connection,
        wallet: undefined as any,
    };

    const chainObject = await new chainClass(
        provider,
        networkObject
    ).initialize(renNetwork);

    console.log(`Handling ${evmNetwork.chainClass.chain}`);

    let total = new BigNumber(0);

    for (const symbol of gateways) {
        const gatewayAddressString =
            await chainObject.resolveTokenGatewayContract(symbol);

        const gatewayAddress = new PublicKey(gatewayAddressString);

        let transactions = List<ConfirmedSignatureInfo>();

        const limit = 1000;
        // Get transactions to the gateway contract, in batches of 1000.
        let before = undefined;
        while (true) {
            const newTransactions = List(
                await connection.getConfirmedSignaturesForAddress2(
                    gatewayAddress,
                    { limit }
                )
            );
            transactions = transactions.merge(newTransactions);
            if (newTransactions.size < limit) {
                break;
            } else {
                before = newTransactions
                    .filter((tx) => tx.blockTime)
                    .sortBy((tx) => tx.blockTime)
                    .first();
            }
        }

        // Remove any transactions from after the timestamp.
        transactions = transactions.filter(
            (transaction) =>
                transaction.blockTime && transaction.blockTime <= timestamp
        );

        if (transactions.size) {
            console.log(
                `Found ${green(transactions.size)} ${
                    chainObject.chain
                } ${symbol} events...`
            );

            for (const transaction of transactions) {
                console.log(
                    `Fetching ${chainObject.chain} ${symbol} transaction ${transaction.signature}...`
                );
                if (transaction.err || !transaction.blockTime) {
                    console.error(
                        red(
                            `Invalid transaction ${transaction.signature} on ${chainObject.chain}.`
                        ),
                        transaction
                    );
                    continue;
                }

                const transactionDetails =
                    await connection.getConfirmedTransaction(
                        transaction.signature
                    );

                if (!transactionDetails) {
                    console.error(
                        `Unable to get transaction details for ${chainObject.chain} transaction ${transaction.signature}.`,
                        transaction
                    );
                    continue;
                }

                if (transactionDetails.meta && transactionDetails.meta.err) {
                    console.error(
                        `${chainObject.chain} transaction ${
                            transaction.signature
                        } had error ${transactionDetails.meta.err.toString()}.`,
                        transaction
                    );
                    continue;
                }

                let found = false;
                for (
                    let i = 0;
                    i < transactionDetails.transaction.instructions.length;
                    i++
                ) {
                    const firstTransaction =
                        transactionDetails.transaction.instructions[i];
                    const secondTransaction =
                        transactionDetails.transaction.instructions[i + 1];

                    // Check for a mint.
                    if (
                        transactionDetails.transaction.instructions.length ===
                            2 &&
                        secondTransaction &&
                        firstTransaction.programId.equals(gatewayAddress) &&
                        firstTransaction.data.equals(Buffer.from([1]))
                    ) {
                        found = true;
                        // The transaction is a mint.

                        const amount = new BN(
                            secondTransaction.data.slice(130, 162)
                        ).toString();
                        const burn = {
                            network: renNetwork,
                            chain: chainObject.chain,
                            symbol,
                            timestamp: transaction.blockTime,
                            amount,
                        };

                        eventArray = eventArray.push(burn);

                        if (symbol === "BTC") {
                            total = total.plus(burn.amount);
                        }
                    }

                    // Check for a burn.
                    if (
                        transactionDetails.transaction.instructions.length ===
                            2 &&
                        secondTransaction &&
                        secondTransaction.programId.equals(gatewayAddress) &&
                        secondTransaction.data[0] === 2
                    ) {
                        found = true;
                        // The transaction is a burn.

                        const amount = new BN(
                            Buffer.from(
                                firstTransaction.data.slice(1, 1 + 8)
                            ).reverse()
                        )
                            .neg()
                            .toString();
                        const burn = {
                            network: renNetwork,
                            chain: chainObject.chain,
                            symbol,
                            timestamp: transaction.blockTime,
                            amount,
                        };

                        eventArray = eventArray.push(burn);

                        if (symbol === "BTC") {
                            total = total.plus(burn.amount);
                        }
                    }

                    // Check for other gateway instructions.
                    if (
                        firstTransaction.programId.equals(gatewayAddress) &&
                        (firstTransaction.data[0] === 0 ||
                            firstTransaction.data[0] === 3 ||
                            firstTransaction.data[0] === 4)
                    ) {
                        found = true;
                    }

                    // Check for SPL program upgrades.
                    if (
                        firstTransaction.programId.toString() ===
                            "BPFLoaderUpgradeab1e11111111111111111111111" &&
                        (firstTransaction.data[0] === 3 ||
                            firstTransaction.data[0] === 2)
                    ) {
                        found = true;
                    }
                }

                if (!found) {
                    console.error(
                        `\nUnknown transaction format for ${chainObject.chain} ${symbol} transaction ${transaction.signature}`
                    );
                    console.log(
                        "transactionDetails.transaction.instructions",
                        transactionDetails.transaction.instructions.length,
                        "\n"
                    );
                    transactionDetails.transaction.instructions.forEach((x) =>
                        console.log(x)
                    );
                    console.log("\n");
                }
            }
        }
    }

    eventArray = eventArray.sort((event) => event.timestamp);

    console.info(
        `Processed ${eventArray.size} trades. Sum of BTC locked on ${
            chainObject.chain
        }: ${total.dividedBy(new BigNumber(10).exponentiatedBy(8))}`
    );

    return eventArray;
};
