import { getSnapshot, getTimestamp, Snapshot } from "../../database/models";
import { RenNetwork } from "../../networks";
import { applyPrice } from "../priceFetcher/PriceFetcher";
import moment from "moment";
import BigNumber from "bignumber.js";
import { List } from "immutable";
import {
    addLocked,
    addVolume,
    getAssetPrice,
    updateAssetPrice,
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

        const asset = event.symbol;

        if (
            !snapshot ||
            snapshot.timestamp !== getTimestamp(moment(event.timestamp * 1000))
        ) {
            if (snapshot) {
                await snapshot.save();
            }
            snapshot = await getSnapshot(moment(event.timestamp * 1000));
        }

        snapshot = await updateAssetPrice(snapshot, asset, event.network);
        const assetPrice = getAssetPrice(snapshot, asset);

        const assetAmount = applyPrice(
            event.chain,
            asset,
            event.amount,
            assetPrice
        );

        snapshot = addVolume(snapshot, assetAmount, assetPrice);
        snapshot = addLocked(snapshot, assetAmount, assetPrice);
    }

    if (snapshot) {
        await snapshot.save();
    }
};
