import { OrderedMap } from "immutable";
import BigNumber from "bignumber.js";
import moment from "moment";

import {
    applyPrice,
    assertPriceIsValid,
    fetchAssetPrice,
} from "../priceFetcher/PriceFetcher";
import { extractError } from "../../common/utils";

import { AssetAmount, AssetPrice } from "../../database/models/Snapshot";
import { RenNetwork } from "../../networks";

export interface ISnapshot {
    id: number | null;
    timestamp: number;
    volume: AssetAmount[];
    locked: AssetAmount[];
    prices: AssetPrice[];
}

const isNumber = (amount: string) => !new BigNumber(amount).isNaN();

const assertAmountIsValid = (amount: AssetAmount, where?: string) => {
    if (!isNumber(amount.amount)) {
        throw new Error(
            `Invalid volume amount 'amount' in ${
                where || "assertAmountIsValid"
            }.`
        );
    }
    if (!isNumber(amount.amountInEth)) {
        throw new Error(
            `Invalid volume amount 'amountInEth' in ${
                where || "assertAmountIsValid"
            }.`
        );
    }
    if (!isNumber(amount.amountInBtc)) {
        throw new Error(
            `Invalid volume amount 'amountInBtc' in ${
                where || "assertAmountIsValid"
            }.`
        );
    }
    if (!isNumber(amount.amountInUsd)) {
        throw new Error(
            `Invalid volume amount 'amountInUsd' in ${
                where || "assertAmountIsValid"
            }.`
        );
    }

    return true;
};

export const addVolume = <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    amountToAdd: AssetAmount,
    assetPrice: AssetPrice | undefined
): Snapshot => {
    assertAmountIsValid(amountToAdd, "amountToAdd in addVolume");
    if (assetPrice) {
        assertPriceIsValid(assetPrice, "assetPrice in addVolume");
    }

    const volumeAndIndex = snapshot.volume
        .map((v, i) => ({ v, i }))
        .find(
            ({ v }) =>
                v.asset === amountToAdd.asset && v.chain === amountToAdd.chain
        );

    if (!volumeAndIndex) {
        snapshot.volume.push(amountToAdd);
    } else {
        let { v, i } = volumeAndIndex;

        if (
            assetPrice &&
            new BigNumber(v.amount).gt(0) &&
            new BigNumber(v.amountInUsd).isZero()
        ) {
            v = applyPrice(v.chain, v.asset, v.amount, assetPrice);
        }

        assertAmountIsValid(v, "v in addVolume");

        const amount = new BigNumber(amountToAdd.amount)
            .abs()
            .plus(v.amount)
            .toFixed();
        const amountInEth = new BigNumber(amountToAdd.amountInEth)
            .abs()
            .plus(v.amountInEth)
            .toFixed();
        const amountInBtc = new BigNumber(amountToAdd.amountInBtc)
            .abs()
            .plus(v.amountInBtc)
            .toFixed();
        const amountInUsd = new BigNumber(amountToAdd.amountInUsd)
            .abs()
            .plus(v.amountInUsd)
            .toFixed();

        snapshot.volume[i] = new AssetAmount(
            amountToAdd.chain,
            amountToAdd.asset,
            amount,
            amountInEth,
            amountInBtc,
            amountInUsd
        );

        assertAmountIsValid(snapshot.volume[i], "volume[i] in addVolume");
    }

    return snapshot;
};

export const setLocked = <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    amount: AssetAmount
) => {
    assertAmountIsValid(amount);

    const volumeAndIndex = snapshot.locked
        .map((v, i) => ({ v, i }))
        .find(({ v }) => v.asset === amount.asset && v.chain === amount.chain);

    if (volumeAndIndex) {
        snapshot.locked[volumeAndIndex.i] = amount;
    } else {
        snapshot.locked.push(amount);
    }

    return snapshot;
};

export const addLocked = <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    amountToAdd: AssetAmount,
    assetPrice: AssetPrice | undefined
) => {
    assertAmountIsValid(amountToAdd);
    if (assetPrice) {
        assertPriceIsValid(assetPrice);
    }

    const lockedAndIndex = snapshot.locked
        .map((l, i) => ({ l, i }))
        .find(
            ({ l }) =>
                l.asset === amountToAdd.asset && l.chain === amountToAdd.chain
        );

    if (lockedAndIndex) {
        let { l, i } = lockedAndIndex;

        assertAmountIsValid(l);

        const amount = new BigNumber(l.amount)
            .plus(amountToAdd.amount)
            .toFixed();

        const { amountInEth, amountInBtc, amountInUsd } = applyPrice(
            amountToAdd.chain,
            amountToAdd.asset,
            amount,
            assetPrice
        );

        snapshot.locked[i] = new AssetAmount(
            amountToAdd.chain,
            amountToAdd.asset,
            amount,
            amountInEth,
            amountInBtc,
            amountInUsd
        );

        assertAmountIsValid(snapshot.locked[i]);

        assertAmountIsValid(snapshot.locked[i], "locked[i] in addVolume");
    } else {
        snapshot.locked.push(amountToAdd);
    }

    return snapshot;
};

export const getAssetPrice = <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    asset: string
): AssetPrice | undefined => snapshot.prices.find((p) => p.asset === asset);

export const updateAssetPrice = async <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    asset: string,
    network: RenNetwork
): Promise<Snapshot> => {
    let newAssetPrice: AssetPrice | undefined = undefined;
    try {
        newAssetPrice = await fetchAssetPrice(
            network,
            asset,
            moment(snapshot.timestamp * 1000)
        );
    } catch (error) {
        console.error(extractError(error, "Unable to fetch asset price."));
    }

    const priceAndIndex = snapshot.prices
        .map((p, i) => ({ p, i }))
        .find(({ p }) => p.asset === asset);

    if (priceAndIndex) {
        const { p, i } = priceAndIndex;
        const {} = snapshot.prices[i];
        snapshot.prices[i] = new AssetPrice(
            asset,
            snapshot.prices[i].decimals || p.decimals || 0,
            snapshot.prices[i].priceInEth || p.priceInEth || 0,
            snapshot.prices[i].priceInBtc || p.priceInBtc || 0,
            snapshot.prices[i].priceInUsd || p.priceInUsd || 0
        );
    } else if (newAssetPrice) {
        snapshot.prices.push(newAssetPrice);
    }

    return snapshot;
};

export enum MintOrBurn {
    MINT = "MINT",
    BURN = "BURN",
}

export const parseSelector = (
    selector: string
): { asset: string; chain: string; mintOrBurn: MintOrBurn } => {
    const v2SelectorMatch = /^([A-Z]+)\/(from|to)(.+)$/.exec(selector);
    if (!v2SelectorMatch) {
        throw new Error(`Invalid selector ${selector}.`);
    }
    const [_, asset, toOrFrom, chain] = v2SelectorMatch;
    return {
        asset,
        chain,
        mintOrBurn: toOrFrom === "to" ? MintOrBurn.MINT : MintOrBurn.BURN,
    };
};
