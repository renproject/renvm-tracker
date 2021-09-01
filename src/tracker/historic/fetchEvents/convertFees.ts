import { List } from "immutable";
import fs from "fs";
import util from "util";
import { HistoricEvent } from "../types";
import { RenNetwork } from "../../../networks";
import { networkConfigs } from "../config";
import moment from "moment";
import BigNumber from "bignumber.js";

const network = RenNetwork.Mainnet;

const INPUT_FILE = `src/tracker/historic/events/${network}-chains.json`;
const OUTPUT_FILE = `src/tracker/historic/events/${network}-chains-converted.json`;

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
    const data = await readFile(INPUT_FILE, "utf-8");

    const networkConfig = networkConfigs[network];

    if (!networkConfig.historicChainEvents) {
        return;
    }

    const json = JSON.parse(data);
    let eventArray = List<HistoricEvent>(json);

    eventArray = eventArray.sortBy((x: any) => x.timestamp);

    console.info(`Writing ${eventArray.size} events to ${OUTPUT_FILE}...`);

    const timestamps: { [timestamp: number]: HistoricEvent[] } = {};
    for (const event of eventArray) {
        if (event.chain !== "Solana") {
            timestamps[event.timestamp] = timestamps[event.timestamp] || [];
            timestamps[event.timestamp].push(event);
        }
    }

    let count = 0;
    for (const timestampS of Object.keys(timestamps)) {
        const timestamp = parseInt(timestampS, 10);
        if (
            timestamp >= networkConfig.historicChainEvents.fromTimestamp &&
            timestamp <= networkConfig.historicChainEvents.toTimestamp
        ) {
            const events = timestamps[timestamp];
            if (events.length % 2 !== 0) {
                console.log(events.length);
                for (const event of events) {
                    // console.log(
                    //     moment
                    //         .duration(moment().diff(event.timestamp * 1000))
                    //         .humanize()
                    // );
                    // console.log(event);
                }
                count++;
            } else {
                for (let i = 0; i < events.length; i += 2) {
                    const event1 = events[i];
                    const event2 = events[i + 1];

                    const amount1 = new BigNumber(event1.amount);
                    const amount2 = new BigNumber(event2.amount);

                    let round: 0 | 1 = BigNumber.ROUND_DOWN;
                    if (amount1.isNegative() || amount2.isNegative()) {
                        round = BigNumber.ROUND_UP;
                    }

                    const fees = List([10, 15, 20, 25]);
                    const amount1Fees = fees.map((fee) =>
                        amount1
                            .abs()
                            .times(fee)
                            .div(10000)
                            .integerValue(
                                amount1.isNegative()
                                    ? BigNumber.ROUND_DOWN
                                    : BigNumber.ROUND_UP
                            )
                            .toFixed()
                    );
                    const amount2Fees = fees.map((fee) =>
                        amount2
                            .abs()
                            .times(fee)
                            .div(10000)
                            .integerValue(
                                amount2.isNegative()
                                    ? BigNumber.ROUND_DOWN
                                    : BigNumber.ROUND_UP
                            )
                            .toFixed()
                    );

                    const ratio1 = amount2
                        .absoluteValue()
                        .dividedBy(amount1.absoluteValue())
                        .times(10000)
                        .integerValue(round)
                        .toNumber();
                    const ratio2 = amount1
                        .absoluteValue()
                        .dividedBy(amount2.absoluteValue())
                        .times(10000)
                        .integerValue(round)
                        .toNumber();

                    if (
                        !fees.contains(ratio1) &&
                        !fees.contains(ratio2) &&
                        !amount1Fees.contains(amount2.toFixed()) &&
                        !amount2Fees.contains(amount1.toFixed())
                    ) {
                        console.log(
                            `[${timestamp}] ${ratio1}, ${ratio2}, amount1: ${amount1.toFixed()}, amount2: ${amount2.toFixed()}`
                        );
                    }
                }
            }
        }
    }

    console.log("count", count);

    // write file to disk
    const fileString = JSON.stringify(eventArray.toJSON());
    await writeFile(OUTPUT_FILE, fileString);

    console.log(`Done! Wrote ${eventArray.size} events.`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
