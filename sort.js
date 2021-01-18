

const { List } = require("immutable");
const fs = require("fs");

fs.readFile("out.json", "utf-8", (err, data) => {
  if (err) {
      throw err;
  }

  const json = JSON.parse(data);
  let list = List(json);
  list = list.sortBy(x => x.timestamp);
  
  let count = 0;
  for (const trade of list) {
    console.log(JSON.stringify(trade), ",");
    count++;
  }

  console.error(`Processed ${count} trades`);
});