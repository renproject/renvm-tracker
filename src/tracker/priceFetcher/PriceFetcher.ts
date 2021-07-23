import Axios from "axios";
import BigNumber from "bignumber.js";
import { Map, OrderedMap } from "immutable";
import moment, { Moment } from "moment";
import { TokenAmount, TokenPrice } from "../../database/models/Snapshot";

import { DEFAULT_REQUEST_TIMEOUT, SECONDS, time } from "../../util/utils";

export const applyPrice = (
    chain: string,
    asset: string,
    amount: string,
    price: TokenPrice | undefined
): TokenAmount => {
    const shifted = price
        ? new BigNumber(amount).div(
              new BigNumber(10).exponentiatedBy(price.decimals)
          )
        : null;
    return new TokenAmount(
        chain,
        asset,
        amount,
        price && shifted
            ? shifted.times(price.priceInEth).decimalPlaces(8).toFixed()
            : new BigNumber(0).toFixed(),
        price && shifted
            ? shifted.times(price.priceInBtc).decimalPlaces(8).toFixed()
            : new BigNumber(0).toFixed(),
        price && shifted
            ? shifted.times(price.priceInUsd).decimalPlaces(2).toFixed()
            : new BigNumber(0).toFixed()
    );
};

export type TokenPrices = OrderedMap<string, TokenPrice>;

export const tokenIDs: {
    [token: string]: { decimals: number; coinGeckoID: string };
} = {
    // Misc.
    ["ETH"]: {
        decimals: 18,
        coinGeckoID: "ethereum",
    },
    ["REN"]: {
        decimals: 18,
        coinGeckoID: "republic-protocol",
    },
    ["DAI"]: {
        decimals: 18,
        coinGeckoID: "dai",
    },
    // RenVM assets
    ["BTC"]: {
        decimals: 8,
        coinGeckoID: "bitcoin",
    },
    ["ZEC"]: {
        decimals: 8,
        coinGeckoID: "zcash",
    },
    ["BCH"]: {
        decimals: 8,
        coinGeckoID: "bitcoin-cash",
    },
    ["FIL"]: {
        coinGeckoID: "filecoin",
        decimals: 18,
    },
    ["DGB"]: {
        coinGeckoID: "digibyte",
        decimals: 8,
    },
    ["DOGE"]: {
        coinGeckoID: "dogecoin",
        decimals: 8,
    },
    ["LUNA"]: {
        coinGeckoID: "terra-luna",
        decimals: 6,
    },
};

const CACHE_EXPIRY = 10 * SECONDS;

let priceCache = Map<string, TokenPrice>();
let priceCacheTimestamp = Map<string, number>();
let historicPriceCache = Map<string, Map<string, TokenPrice>>();

const coinGeckoURL = `https://api.coingecko.com/api/v3`;
const coinGeckoParams = `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

export const fetchTokenPrice = async (
    token: string,
    timestamp?: Moment
): Promise<TokenPrice | undefined> => {
    let date;
    // If from more than 1 hour ago, get historic data.
    if (timestamp && moment.duration(moment().diff(timestamp)).asHours() > 1) {
        date = timestamp.format("DD-MM-yy");
    }

    if (date) {
        const historicCache = historicPriceCache
            .get(token, Map<string, TokenPrice>())
            .get(date);
        if (historicCache) {
            return historicCache;
        }
    }

    let cached = priceCache.get(token, undefined);
    const cachedTimestamp = priceCacheTimestamp.get(token, 0);
    if (cached && time() - cachedTimestamp <= CACHE_EXPIRY) {
        return cached;
    }

    const { decimals, coinGeckoID } = tokenIDs[token] || { decimals: 0 };

    let priceInEth = 0;
    let priceInBtc = 0;
    let priceInUsd = 0;
    if (coinGeckoID) {
        let url;

        if (date) {
            url = `${coinGeckoURL}/coins/${coinGeckoID}/history?${coinGeckoParams}&date=${date}`;
        } else {
            url = `${coinGeckoURL}/coins/${coinGeckoID}?${coinGeckoParams}`;
        }

        console.log(`Getting price for ${token} (${date ? date : "now"})`);

        const response = await Axios.get<{
            market_data: { current_price: { [currency: string]: number } };
        }>(url, {
            timeout: DEFAULT_REQUEST_TIMEOUT,
        });

        priceInEth = response.data.market_data.current_price["eth"];
        priceInBtc = response.data.market_data.current_price["btc"];
        priceInUsd = response.data.market_data.current_price["usd"];
    }

    if (isNaN(priceInEth) || isNaN(priceInBtc) || isNaN(priceInUsd)) {
        throw new Error(
            `Invalid prices (${String(priceInEth)}, ${String(
                priceInBtc
            )}, ${String(priceInUsd)})`
        );
    }

    const tokenPrice = new TokenPrice(
        token,
        decimals,
        priceInEth,
        priceInBtc,
        priceInUsd
    );

    assertPriceIsValid(tokenPrice);

    if (date) {
        historicPriceCache = historicPriceCache.set(
            token,
            historicPriceCache
                .get(token, Map<string, TokenPrice>())
                .set(date, tokenPrice)
        );
    } else {
        priceCacheTimestamp = priceCacheTimestamp.set(token, time());
        priceCache = priceCache.set(token, tokenPrice);
    }

    return tokenPrice;
};

export const assertPriceIsValid = (price: TokenPrice, where?: string) => {
    if (isNaN(price.decimals)) {
        throw new Error(
            `Invalid price field 'decimals' in ${where || "assetPriceIsValid"}.`
        );
    }
    if (isNaN(price.priceInEth)) {
        throw new Error(
            `Invalid price field 'priceInEth' in ${
                where || "assetPriceIsValid"
            }.`
        );
    }
    if (isNaN(price.priceInBtc)) {
        throw new Error(
            `Invalid price field 'priceInBtc' in ${
                where || "assetPriceIsValid"
            }.`
        );
    }
    if (isNaN(price.priceInUsd)) {
        throw new Error(
            `Invalid price field 'priceInUsd' in ${
                where || "assetPriceIsValid"
            }.`
        );
    }

    return true;
};
