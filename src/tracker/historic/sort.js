// @ts-check

const { List } = require("immutable");
const fs = require("fs");
const util = require("util");

const INPUT_FILES = [
    "src/indexer/final-96566.jsonFantom",
    "src/indexer/final-96566.jsonAvalanche",
    "src/indexer/final-96566.jsonEthereum",
    "src/indexer/final-96566.jsonBinanceSmartChain",
    // "src/indexer/final-96566.jsonPolygon",
    "src/indexer/final-96566.json",
];
const OUTPUT_FILE = "src/indexer/final-96566-sorted.json";

const readFileSync = util.promisify(fs.readFileSync);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
    let eventArray = List();

    for (const filename of INPUT_FILES) {
        const data = await readFileSync(filename, "utf-8");

        const json = JSON.parse(data);
        const tmpArray = List(json);
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
