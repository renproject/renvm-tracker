import { List } from "immutable";
import fs from "fs";
import util from "util";
import { HistoricEvent } from "../types";

const INPUT_FILES = [
    "src/tracker/historic/events/testnet.jsonFantom",
    "src/tracker/historic/events/testnet.jsonAvalanche",
    "src/tracker/historic/events/testnet.jsonBinanceSmartChain",
    "src/tracker/historic/events/testnet.jsonPolygon",
    "src/tracker/historic/events/testnet.jsonEthereum",
    "src/tracker/historic/events/testnet.jsonSolana",
];
const OUTPUT_FILE = "src/tracker/historic/events/testnet.json";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
    let eventArray = List<HistoricEvent>();

    for (const filename of INPUT_FILES) {
        const data = await readFile(filename, "utf-8");

        const json = JSON.parse(data);
        const tmpArray = List<HistoricEvent>(json);
        eventArray = eventArray.merge(tmpArray);
        console.log(`Loaded ${tmpArray.size} events from ${filename}`);
    }

    eventArray = eventArray.sortBy((x) => x.timestamp);

    console.info(`Writing ${eventArray.size} events to ${OUTPUT_FILE}...`);

    // write file to disk
    const fileString = JSON.stringify(eventArray.toJSON());
    await writeFile(OUTPUT_FILE, fileString);

    console.log(`Done! Wrote ${eventArray.size} events.`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
