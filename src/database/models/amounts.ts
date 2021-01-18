import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { ColumnCommonOptions } from "typeorm/decorator/options/ColumnCommonOptions";
import { applyPrice } from "../../indexer/priceCache";

export interface TokenAmount {
    amount: BigNumber;
    amountInEth: BigNumber;
    amountInBtc: BigNumber;
    amountInUsd: BigNumber;
}

export const TokenAmountZero = {
    amount: new BigNumber(0),
    amountInEth: new BigNumber(0),
    amountInBtc: new BigNumber(0),
    amountInUsd: new BigNumber(0),
};

export interface TokenPrice {
    // name: string;
    decimals: number;
    priceInEth: number;
    priceInBtc: number;
    priceInUsd: number;
}

export const addToTokenAmount = (
    existing: TokenAmount,
    amount: TokenAmount,
    price?: TokenPrice
): TokenAmount => {
    if (existing.amount.gt(0) && existing.amountInUsd.isZero()) {
        existing = applyPrice(existing.amount, price);
    }

    return {
        amount: existing.amount.plus(amount.amount),
        amountInEth: existing.amountInEth.plus(amount.amountInEth),
        amountInBtc: existing.amountInBtc.plus(amount.amountInBtc),
        amountInUsd: existing.amountInUsd.plus(amount.amountInUsd),
    };
};

export const subtractFromTokenAmount = (
    existing: TokenAmount,
    amount: TokenAmount,
    price?: TokenPrice
): TokenAmount => {
    if (existing.amount.gt(0) && existing.amountInUsd.isZero()) {
        existing = applyPrice(existing.amount, price);
    }

    return {
        amount: existing.amount.minus(amount.amount),
        amountInEth: existing.amountInEth.minus(amount.amountInEth),
        amountInBtc: existing.amountInBtc.minus(amount.amountInBtc),
        amountInUsd: existing.amountInUsd.minus(amount.amountInUsd),
    };
};

export type VolumeMap = OrderedMap<string, TokenAmount>;

export type PriceMap = OrderedMap<string, TokenPrice>;

export const volumeMapToJSON = (volumeMap: VolumeMap): string => {
    return JSON.stringify(
        volumeMap
            .map((token) => ({
                ...token,
                amount: token.amount.toFixed(),
                amountInEth: token.amountInEth.toFixed(),
                amountInBtc: token.amountInBtc.toFixed(),
                amountInUsd: token.amountInUsd.toFixed(),
            }))
            .toJSON()
    );
};

export const volumeMapFromJSON = (json: string): VolumeMap => {
    return OrderedMap<string, TokenAmount>(JSON.parse(json)).map((token) => ({
        ...token,
        amount: new BigNumber(token.amount),
        amountInEth: new BigNumber(token.amountInEth),
        amountInBtc: new BigNumber(token.amountInBtc),
        amountInUsd: new BigNumber(token.amountInUsd),
    }));
};

export const VolumeMapTransformer: ColumnCommonOptions = {
    transformer: {
        to: volumeMapToJSON,
        from: volumeMapFromJSON,
    },
};

export const bigNumberToBigInt = (bigNumber: BigNumber): string => {
    return bigNumber.toFixed();
};

export const bigNumberFromBigInt = (bigInt: string): BigNumber => {
    return new BigNumber(bigInt);
};

export const BigNumberTransformer: ColumnCommonOptions = {
    transformer: {
        to: volumeMapToJSON,
        from: volumeMapFromJSON,
    },
};

export const priceMapToJSON = (priceMap: PriceMap): string =>
    JSON.stringify(priceMap.toJSON());

export const priceMapFromJSON = (json: string): PriceMap =>
    OrderedMap<string, TokenPrice>(JSON.parse(json));

export const PriceMapTransformer: ColumnCommonOptions = {
    transformer: {
        to: priceMapToJSON,
        from: priceMapFromJSON,
    },
};