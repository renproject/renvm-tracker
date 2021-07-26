import {
    getSnapshot,
    getTimestamp,
    Snapshot,
    TokenPrice,
} from "../../database/models";
import { RenNetwork } from "../../networks";
import { applyPrice } from "../priceFetcher/PriceFetcher";
import moment from "moment";
import BigNumber from "bignumber.js";
import { List } from "immutable";
import {
    addLocked,
    addVolume,
    getTokenPrice,
    updateTokenPrice,
} from "../blockHandler/snapshotUtils";

export interface Web3Event {
    network: RenNetwork;
    chain: string; // "Ethereum"
    symbol: string; // "ZEC";
    timestamp: number; // 1586291424;
    amount: string; // "69930";
}

export const INPUT_FILE = "src/tracker/historic/events/final.json";

export const syncHistoricEventsToDatabase = async (events: List<Web3Event>) => {
    let total = new BigNumber(0);

    let snapshot: Snapshot | undefined;

    for (let i = 0; i < events.size; i++) {
        console.log(
            `Processing event ${i}/${events.size} (${Math.floor(
                (i / events.size) * 100
            )}%)`
        );

        const event = events.get(i);

        if (!event) {
            continue;
        }

        if (event.network === "mainnet" && event.symbol === "BTC") {
            total = total.plus(event.amount);
            console.log(
                "total",
                total.dividedBy(new BigNumber(10).exponentiatedBy(8)).toFixed()
            );
        }

        if (
            !snapshot ||
            snapshot.timestamp !== getTimestamp(moment(event.timestamp * 1000))
        ) {
            if (snapshot) {
                snapshot.save();
            }
            snapshot = await getSnapshot(moment(event.timestamp * 1000));
        }

        snapshot = await updateTokenPrice(
            snapshot,
            event.symbol,
            event.network
        );
        const tokenPrice = getTokenPrice(snapshot, event.symbol);

        const tokenAmount = applyPrice(
            event.chain,
            event.symbol,
            event.amount,
            tokenPrice
        );

        snapshot = addVolume(snapshot, tokenAmount, tokenPrice);
        snapshot = addLocked(snapshot, tokenAmount, tokenPrice);
    }

    if (snapshot) {
        await snapshot.save();
    }
};
