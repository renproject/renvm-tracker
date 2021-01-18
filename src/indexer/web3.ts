import {
    addLocked,
    addVolume,
    getTimeBlock,
    getTimestamp,
    RenNetwork,
    RenVMInstance,
    RenVMInstances,
    subtractLocked,
    TimeBlock,
} from "../database/models";
import { applyPrice, getTokenPrice } from "./priceCache";
import moment from "moment";
import BigNumber from "bignumber.js";

export interface Web3Event {
    network: RenVMInstances; // "mainnet-v0.3";
    chain: "Ethereum" | "BinanceSmartChain";
    symbol: string; // "ZEC";
    timestamp: number; // 1586291424;
    amount: string; // "69930";
}

export const processEvents = async (events: Web3Event[]) => {
    // const instances = {
    //     [RenVMInstances.Mainnet]: await RenVMInstance.findOneOrFail({
    //         name: RenVMInstances.Mainnet,
    //     }),
    //     [RenVMInstances.MainnetVDot3]: await RenVMInstance.findOneOrFail({
    //         name: RenVMInstances.MainnetVDot3,
    //     }),
    //     [RenVMInstances.Testnet]: await RenVMInstance.findOneOrFail({
    //         name: RenVMInstances.Testnet,
    //     }),
    //     [RenVMInstances.TestnetVDot3]: await RenVMInstance.findOneOrFail({
    //         name: RenVMInstances.TestnetVDot3,
    //     }),
    // };

    let nextTimeBlock: TimeBlock | null = null;

    for (let i = 0; i < events.length; i++) {
        console.log(
            `Processing event ${i}/${events.length} (${Math.floor(
                (i / events.length) * 100
            )}%)`
        );

        const event = events[i];
        const time = moment(event.timestamp * 1000);
        const timestamp = getTimestamp(moment(event.timestamp * 1000));

        const network = event.network.split("-")[0] as RenNetwork;

        const price = await getTokenPrice(event.symbol, time);

        let timeBlock: TimeBlock = nextTimeBlock
            ? nextTimeBlock
            : await getTimeBlock(timestamp);

        const rawAmount = new BigNumber(event.amount);
        const isBurn = rawAmount.isNegative();
        const amount = rawAmount.absoluteValue();

        const tokenAmount = applyPrice(amount, price);

        const selector = `${event.symbol.toUpperCase()}/${event.chain}`;

        timeBlock = addVolume(timeBlock, network, selector, tokenAmount, price);
        timeBlock = (isBurn ? subtractLocked : addLocked)(
            timeBlock,
            network,
            selector,
            tokenAmount,
            price
        );

        // Update price for symbol.
        timeBlock.pricesJSON = timeBlock.pricesJSON.set(event.symbol, {
            decimals: 0,
            priceInEth: 0,
            priceInBtc: 0,
            priceInUsd: 0,
            ...timeBlock.pricesJSON.get(event.symbol, undefined),
            ...price,
        });

        if (
            i + 1 < events.length &&
            getTimestamp(moment(events[i + 1].timestamp * 1000)) === timestamp
        ) {
            nextTimeBlock = timeBlock;
        } else {
            console.log(`Saving time-block ${timestamp}.`);
            await timeBlock.save();
            nextTimeBlock = null;
        }
    }
};
