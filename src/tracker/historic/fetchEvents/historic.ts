import { List } from "immutable";
import { writeFile } from "fs";
import { RenNetwork } from "@renproject/interfaces";
import { config } from "dotenv";
import {
    avalanche,
    binanceSmartChain,
    ethereum,
    fantom,
    getHistoricEVMEvents,
    polygon,
} from "./historicEVM";
import { getHistoricSolanaEvents, solana } from "./historicSolana";

config();

const timestamps = {
    [RenNetwork.Mainnet]: 1626375768, // Mainnet block 96566.
    [RenNetwork.Testnet]: 1628039181, // Testnet block 104.
};

const NETWORK = RenNetwork.Testnet;
const OUTPUT_FILE = `./src/tracker/historic/events/${NETWORK}-chains.json`;

const main = async () => {
    let eventArray = List();

    // EVM chains
    for (const networkDetails of [
        // fantom,
        // avalanche,
        // binanceSmartChain,
        // polygon,
        // ethereum,
    ]) {
        eventArray = eventArray.merge(
            await getHistoricEVMEvents(
                timestamps[NETWORK],
                networkDetails,
                NETWORK,
                OUTPUT_FILE
            )
        );
    }

    // Solana chains
    for (const networDetails of [solana]) {
        eventArray = eventArray.merge(
            await getHistoricSolanaEvents(
                timestamps[NETWORK],
                networDetails,
                NETWORK
            )
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
