import Axios from "axios";
import BigNumber from "bignumber.js";
import { magenta, yellow } from "chalk";
import { Map, OrderedMap } from "immutable";
import moment, { Moment } from "moment";

import { DEFAULT_REQUEST_TIMEOUT, SECONDS, time } from "../../common/utils";
import {
    AssetAmount,
    AssetAmountWithChain,
    AssetPrice,
} from "../../database/models/Snapshot";
import { RenNetwork } from "../../networks";

export const applyPriceWithChain = (
    chain: string,
    asset: string,
    amount: string,
    price: AssetPrice | undefined
): AssetAmountWithChain => {
    const shifted = price
        ? new BigNumber(amount).div(
              new BigNumber(10).exponentiatedBy(price.decimals)
          )
        : null;
    return new AssetAmountWithChain(
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

export const applyPrice = (
    asset: string,
    amount: string,
    price: AssetPrice | undefined
): AssetAmount => {
    const shifted = price
        ? new BigNumber(amount).div(
              new BigNumber(10).exponentiatedBy(price.decimals)
          )
        : null;
    return new AssetAmount(
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

export type AssetPrices = OrderedMap<string, AssetPrice>;

export const assetIDs: {
    [asset: string]: { decimals: number; coinGeckoID: string };
} = {
    // Lock assets
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

    // Ethereum assets
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
    ["USDC"]: {
        decimals: 6,
        coinGeckoID: "usd-coin",
    },
    ["USDT"]: {
        decimals: 6,
        coinGeckoID: "tether",
    },
    ["EURT"]: {
        decimals: 6,
        coinGeckoID: "tether-eurt",
    },
    ["BUSD"]: {
        decimals: 18,
        coinGeckoID: "binance-usd",
    },
    ["MIM"]: {
        decimals: 18,
        coinGeckoID: "magic-internet-money",
    },
    ["CRV"]: {
        decimals: 18,
        coinGeckoID: "curve-dao-token",
    },
    ["LINK"]: {
        decimals: 18,
        coinGeckoID: "chainlink",
    },
    ["UNI"]: {
        decimals: 18,
        coinGeckoID: "uniswap",
    },
    ["SUSHI"]: {
        decimals: 18,
        coinGeckoID: "sushi",
    },
    ["FTT"]: {
        decimals: 18,
        coinGeckoID: "ftx-token",
    },
    ["ROOK"]: {
        decimals: 18,
        coinGeckoID: "rook",
    },
    ["BADGER"]: {
        decimals: 18,
        coinGeckoID: "badger-dao",
    },
    ["KNC"]: {
        decimals: 18,
        coinGeckoID: "kyber-network-crystal",
    },

    // Other chains
    ["ArbETH"]: {
        decimals: 18,
        // There's no separate price feed for ArbETH.
        coinGeckoID: "ethereum",
    },
    ["BNB"]: {
        decimals: 18,
        coinGeckoID: "binancecoin",
    },
    ["MATIC"]: {
        decimals: 18,
        coinGeckoID: "matic-network",
    },
    ["FTM"]: {
        decimals: 18,
        coinGeckoID: "fantom",
    },
    ["AVAX"]: {
        decimals: 18,
        coinGeckoID: "avalanche-2",
    },
    ["gETH"]: {
        decimals: 18,
        // Goerli ETH
        coinGeckoID: "ethereum",
    },
    ["KAVA"]: {
        decimals: 18,
        coinGeckoID: "kava",
    },
    ["GLMR"]: {
        decimals: 18,
        coinGeckoID: "moonbeam",
    },
};

const CACHE_EXPIRY = 10 * SECONDS;

let priceCache = Map<string, AssetPrice>();
let priceCacheTimestamp = Map<string, number>();
let historicPriceCache = Map<string, Map<string, AssetPrice>>();

const coinGeckoURL = `https://api.coingecko.com/api/v3`;
const coinGeckoParams = `localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

export const fetchAssetPrice = async (
    network: RenNetwork,
    asset: string,
    timestamp?: Moment
): Promise<AssetPrice | undefined> => {
    let date;
    // If from more than 1 hour ago, get historic data.
    if (timestamp && moment.duration(moment().diff(timestamp)).asHours() > 1) {
        date = timestamp.format("DD-MM-yy");
    }

    if (date) {
        const historicCache = historicPriceCache
            .get(asset, Map<string, AssetPrice>())
            .get(date);
        if (historicCache) {
            return historicCache;
        }
    }

    let cached = priceCache.get(asset, undefined);
    const cachedTimestamp = priceCacheTimestamp.get(asset, 0);
    if (cached && time() - cachedTimestamp <= CACHE_EXPIRY) {
        return cached;
    }

    const { decimals, coinGeckoID } = assetIDs[asset] || { decimals: 0 };

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

        console.log(
            `${yellow(`[${network}]`)} Getting price for ${magenta(asset)} (${
                date ? date : "now"
            })`
        );

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

    const assetPrice = new AssetPrice(
        asset,
        decimals,
        priceInEth,
        priceInBtc,
        priceInUsd
    );

    assertPriceIsValid(assetPrice);

    if (date) {
        historicPriceCache = historicPriceCache.set(
            asset,
            historicPriceCache
                .get(asset, Map<string, AssetPrice>())
                .set(date, assetPrice)
        );
    } else {
        priceCacheTimestamp = priceCacheTimestamp.set(asset, time());
        priceCache = priceCache.set(asset, assetPrice);
    }

    return assetPrice;
};

export const assertPriceIsValid = (price: AssetPrice, where?: string) => {
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
