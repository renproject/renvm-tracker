import { getSnapshot, getTimestamp, Snapshot } from "../../database/models";
import { RenNetwork } from "../../networks";
import { applyPriceWithChain } from "../priceFetcher/PriceFetcher";
import moment from "moment";
import { List } from "immutable";
import {
    addFees,
    addLocked,
    addVolume,
    getAssetPrice,
    updateAssetPrice,
} from "../blockHandler/snapshotUtils";
import { HistoricEvent } from "./types";
import { networkConfigs } from "./config";

export const loadHistoricEVMEvents = async (
    network: RenNetwork,
    events: List<HistoricEvent>
) => {
    let snapshot: Snapshot | undefined;

    const networkConfig = networkConfigs[network];

    if (!networkConfig.historicChainEvents) {
        return;
    }

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

        if (
            event.timestamp < networkConfig.historicChainEvents.fromTimestamp ||
            event.timestamp > networkConfig.historicChainEvents.toTimestamp
        ) {
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

        snapshot = await updateAssetPrice(
            snapshot,
            asset,
            event.network as RenNetwork
        );
        const assetPrice = getAssetPrice(snapshot, asset);

        const assetAmount = applyPriceWithChain(
            event.chain,
            asset,
            event.amount,
            assetPrice
        );

        snapshot = addVolume(snapshot, assetAmount, assetPrice);
        snapshot = addLocked(snapshot, assetAmount, assetPrice);

        const feeRecipient =
            event.chain === "Ethereum"
                ? "0xe33417797d6b8aec9171d0d6516e88002fbe23e7"
                : "0xfe45ab17919759cfa2ce35215ead5ca4d1fc73c7";
        if (event.to.toLowerCase() === feeRecipient) {
            snapshot = addFees(snapshot, assetAmount, assetPrice);
        }
    }

    if (snapshot) {
        await snapshot.save();
    }
};
