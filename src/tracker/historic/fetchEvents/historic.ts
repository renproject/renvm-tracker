import { List } from "immutable";
import { writeFile } from "fs";
import { RenNetwork } from "@renproject/interfaces";
import { config } from "dotenv";
import {
    avalanche,
    binanceSmartChain,
    ethereum,
    fantom,
    polygon,
    getHistoricEVMEvents,
} from "./historicEVM";
import { getHistoricSolanaEvents, solana } from "./historicSolana";

config();

// Mainnet block 96566.
const timestamp = 1626375768;

const OUTPUT_FILE = "./src/historic/events/since-96566-2.json";

const NETWORK = RenNetwork.Mainnet;

const main = async () => {
    let eventArray = List();

    // EVM chains
    for (const networkDetails of [
        // fantom,
        // avalanche,
        ethereum,
        // binanceSmartChain,
        // polygon,
    ]) {
        eventArray = eventArray.merge(
            await getHistoricEVMEvents(
                timestamp,
                networkDetails,
                NETWORK,
                OUTPUT_FILE
            )
        );
    }

    // Solana chains
    for (const networDetails of [
        // solana
    ]) {
        eventArray = eventArray.merge(
            await getHistoricSolanaEvents(timestamp, networDetails, NETWORK)
        );
    }

    console.info(`
        \n
        \n
        \n
Done fetching events.\n
Sorting ${eventArray.size} events...
    `);

    eventArray = eventArray.sortBy((x) => x.timestamp);

    const fileString = JSON.stringify(eventArray.toJSON());

    console.info(`Writing ${eventArray.size} events to ${OUTPUT_FILE}...`);

    // write file to disk
    writeFile(OUTPUT_FILE, fileString, "utf8", (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`Done! Wrote ${eventArray.size} events.`);
        }
    });
};

main().catch(console.error);

// 49743

// 118844.90071549 - 50112 events
