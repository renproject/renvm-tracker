import { List } from "immutable";
import fs from "fs";
import util from "util";
import { HistoricEvent } from "../types";

const INPUT_FILE = "src/tracker/historic/events/testnet.json";
const OUTPUT_FILE = "src/tracker/historic/events/testnet.json";

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
    const data = await readFile(INPUT_FILE, "utf-8");

    const json = JSON.parse(data);
    let eventArray = List<HistoricEvent>(json);

    eventArray = eventArray.sortBy((x: any) => x.timestamp);

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
