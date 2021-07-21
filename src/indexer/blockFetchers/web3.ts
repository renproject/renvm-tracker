import {
    addLocked,
    addVolume,
    getTimeBlock,
    getTimestamp,
    RenVMInstances,
    subtractLocked,
    TimeBlock,
} from "../../database/models";
import { applyPrice, getTokenPrice } from "../PriceFetcher";
import moment from "moment";
import BigNumber from "bignumber.js";
import { List } from "immutable";
import { TokenPrice } from "../../database/models/amounts";

export interface Web3Event {
    network: RenVMInstances; // "mainnet-v0.3";
    chain: "Ethereum" | "BinanceSmartChain";
    symbol: string; // "ZEC";
    timestamp: number; // 1586291424;
    amount: string; // "69930";
}

export const processEvents = async (events: List<Web3Event>) => {
    let nextTimeBlock: TimeBlock | null = null;

    let total = new BigNumber(0);

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

        const time = moment(event.timestamp * 1000);
        const timestamp = getTimestamp(moment(event.timestamp * 1000));

        // const network = event.network.split("-")[0] as RenNetwork;

        let tokenPrice: TokenPrice | undefined = undefined;
        try {
            tokenPrice = await getTokenPrice(event.symbol, time);
        } catch (error) {
            console.error(tokenPrice);
        }

        let timeBlock: TimeBlock = nextTimeBlock
            ? nextTimeBlock
            : await getTimeBlock(timestamp);

        const rawAmount = new BigNumber(event.amount);
        const isBurn = rawAmount.isNegative();
        const amount = rawAmount.absoluteValue();

        const tokenAmount = applyPrice(amount, tokenPrice);

        const selector = `${event.symbol.toUpperCase()}/${event.chain}`;

        timeBlock = addVolume(timeBlock, selector, tokenAmount, tokenPrice);
        timeBlock = (isBurn ? subtractLocked : addLocked)(
            timeBlock,
            selector,
            tokenAmount,
            tokenPrice
        );

        // Update price for symbol.
        timeBlock.pricesJSON = timeBlock.pricesJSON.set(event.symbol, {
            decimals: 0,
            priceInEth: 0,
            priceInBtc: 0,
            priceInUsd: 0,
            ...timeBlock.pricesJSON.get(event.symbol, undefined),
            ...tokenPrice,
        });

        const nextEvent = events.get(i + 1);

        if (
            nextEvent &&
            getTimestamp(moment(nextEvent.timestamp * 1000)) === timestamp
        ) {
            nextTimeBlock = timeBlock;
        } else {
            console.log(`Saving time-block ${timestamp}.`);
            await timeBlock.save();
            nextTimeBlock = null;
        }
    }
};
