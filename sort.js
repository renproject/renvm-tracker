const { List } = require("immutable");
const { writeFile, readFile } = require("fs");

const OUTPUT_FILE = "src/indexer/final-sorted.json";

readFile("src/indexer/final-unsorted.json", "utf-8", (err, data) => {
    if (err) {
        throw err;
    }

    const json = JSON.parse(data);
    let eventArray = List(json);
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

    // let count = 0;
    // for (const trade of list) {
    //     console.log(JSON.stringify(trade), ",");
    //     count++;
    // }

    // console.error(`Processed ${count} trades`);
});
