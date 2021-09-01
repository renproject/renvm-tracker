import { List } from "immutable";
import fs from "fs";
import util from "util";
import { HistoricEvent } from "../types";

const INPUT_FILES = [
    { file: "src/tracker/historic/events/mainnet-chains.jsonFantom" },
    { file: "src/tracker/historic/events/mainnet-chains.jsonAvalanche" },
    { file: "src/tracker/historic/events/mainnet-chains.jsonEthereum" },
    {
        file: "src/tracker/historic/events/mainnet-chains.json",
        filter: (event: HistoricEvent) =>
            event.chain !== "Fantom" &&
            event.chain !== "Ethereum" &&
            event.chain !== "Fantom",
    },
];
const OUTPUT_FILE = "src/tracker/historic/events/mainnet-chains-new.json";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
    let eventArray = List<HistoricEvent>();

    for (const { file, filter } of INPUT_FILES) {
        const data = await readFile(file, "utf-8");

        const json = JSON.parse(data);
        const tmpArray = List<HistoricEvent>(json);
        const filteredArray = filter ? tmpArray.filter(filter) : tmpArray;

        eventArray = eventArray.merge(filteredArray);
        console.log(
            `Loaded ${filteredArray.size} of ${tmpArray.size} events from ${file}`
        );
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
