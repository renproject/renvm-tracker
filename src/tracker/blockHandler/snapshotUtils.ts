import { parseV1Selector } from "@renproject/utils";
import { OrderedMap } from "immutable";
import BigNumber from "bignumber.js";
import moment from "moment";

import {
    applyPrice,
    assertPriceIsValid,
    fetchTokenPrice,
} from "../priceFetcher/PriceFetcher";
import { extractError } from "../../common/utils";

import { TokenAmount, TokenPrice } from "../../database/models/Snapshot";

export interface ISnapshot {
    id: number | null;
    timestamp: number;
    volume: TokenAmount[];
    locked: TokenAmount[];
    prices: TokenPrice[];
}

const isNumber = (amount: string) => !new BigNumber(amount).isNaN();

const assertAmountIsValid = (amount: TokenAmount, where?: string) => {
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
    amountToAdd: TokenAmount,
    tokenPrice: TokenPrice | undefined
): Snapshot => {
    assertAmountIsValid(amountToAdd, "amountToAdd in addVolume");
    if (tokenPrice) {
        assertPriceIsValid(tokenPrice, "tokenPrice in addVolume");
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
            tokenPrice &&
            new BigNumber(v.amount).gt(0) &&
            new BigNumber(v.amountInUsd).isZero()
        ) {
            v = applyPrice(v.chain, v.asset, v.amount, tokenPrice);
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

        snapshot.volume[i] = new TokenAmount(
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
    amount: TokenAmount
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
    amountToAdd: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    assertAmountIsValid(amountToAdd);
    if (tokenPrice) {
        assertPriceIsValid(tokenPrice);
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
            tokenPrice
        );

        snapshot.locked[i] = new TokenAmount(
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

export const getTokenPrice = <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    asset: string
): TokenPrice | undefined => snapshot.prices.find((p) => p.token === asset);

export const updateTokenPrice = async <Snapshot extends ISnapshot>(
    snapshot: Snapshot,
    asset: string
): Promise<Snapshot> => {
    let newTokenPrice: TokenPrice | undefined = undefined;
    try {
        newTokenPrice = await fetchTokenPrice(
            asset,
            moment(snapshot.timestamp * 1000)
        );
    } catch (error) {
        console.error(extractError(error, "Unable to get token price."));
    }

    const priceAndIndex = snapshot.prices
        .map((p, i) => ({ p, i }))
        .find(({ p }) => p.token === asset);

    if (priceAndIndex) {
        const { p, i } = priceAndIndex;
        const {} = snapshot.prices[i];
        snapshot.prices[i] = new TokenPrice(
            asset,
            snapshot.prices[i].decimals || p.decimals || 0,
            snapshot.prices[i].priceInEth || p.priceInEth || 0,
            snapshot.prices[i].priceInBtc || p.priceInBtc || 0,
            snapshot.prices[i].priceInUsd || p.priceInUsd || 0
        );
    } else if (newTokenPrice) {
        snapshot.prices.push(newTokenPrice);
    }

    return snapshot;
};

export enum MintOrBurn {
    MINT = "MINT",
    BURN = "BURN",
}

const v1ChainMap = OrderedMap<string, string>().set("Eth", "Ethereum");

export const parseSelector = (
    selector: string
): { asset: string; token: string; chain: string; mintOrBurn: MintOrBurn } => {
    const v2SelectorMatch = /^([A-Z]+)\/(from|to)(.+)$/.exec(selector);
    if (v2SelectorMatch) {
        const [_, asset, toOrFrom, chain] = v2SelectorMatch;
        return {
            asset,
            chain,
            token: `${asset.toUpperCase()}/${chain}`,
            mintOrBurn: toOrFrom === "to" ? MintOrBurn.MINT : MintOrBurn.BURN,
        };
    }

    const { asset, from, to } = parseV1Selector(selector);
    const isMint = asset === from.toUpperCase();
    const mintChain: string = v1ChainMap.get(
        isMint ? to : from,
        isMint ? to : from
    );
    return {
        asset,
        chain: mintChain,
        token: `${asset.toUpperCase()}/${mintChain}`,
        mintOrBurn: isMint ? MintOrBurn.MINT : MintOrBurn.BURN,
    };
};
