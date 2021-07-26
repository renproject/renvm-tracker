import { AssetAmount, AssetPrice } from "../src/database/models/Snapshot";
import {
    ISnapshot,
    addVolume,
} from "../src/tracker/blockHandler/snapshotUtils";
import { applyPrice } from "../src/tracker/priceFetcher/PriceFetcher";

const emptySnapshot: ISnapshot = {
    id: 0,
    timestamp: 0,
    volume: [],
    locked: [],
    prices: [],
};

const assetPrice = (symbol: string, usd: number) => {
    return new AssetPrice("BTC", 10, usd / 2500, usd / 30000, usd);
};

describe("snapshotUtils", () => {
    it("addVolume", () => {
        const price = assetPrice("BTC", 30000);
        const amount = applyPrice("Ethereum", "BTC", "1", price);
        const newSnapshot = addVolume(emptySnapshot, amount, price);

        console.log("old", JSON.stringify(emptySnapshot));
        console.log("new", JSON.stringify(newSnapshot));
    });

    it("setLocked", () => {});

    it("addLocked", () => {});

    it("getAssetPrice", () => {});

    it("updateAssetPrice", () => {});

    it("parseSelector", () => {});
});
