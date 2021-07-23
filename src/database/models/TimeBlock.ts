import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    LessThan,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { parseV1Selector } from "@renproject/utils";

import { Moment } from "moment";
import {
    addToTokenAmount,
    subtractFromTokenAmount,
    PriceMap,
    PriceMapTransformer,
    TokenAmountZero,
    TokenPrice,
    VolumeMap,
    VolumeMapTransformer,
    TokenAmount,
} from "./amounts";
import { OrderedMap } from "immutable";
import { red } from "chalk";
import { DEBUG } from "../../environmentVariables";
import { getTokenPrice } from "../../tracker/priceFetcher/PriceFetcher";
import { extractError } from "../../utils";

export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

export const TIME_BLOCK_LENGTH = 300;

export interface PartialTimeBlock {
    volumeJSON: VolumeMap;
    lockedJSON: VolumeMap;
    pricesJSON: PriceMap;
}

export const defaultPartialTimeBlock: PartialTimeBlock = {
    volumeJSON: OrderedMap(),
    lockedJSON: OrderedMap(),
    pricesJSON: OrderedMap(),
};

@Entity()
@ObjectType()
@Unique(["timestamp"])
export class TimeBlock extends BaseEntity implements PartialTimeBlock {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => Number)
    @Column()
    timestamp!: number;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    volumeJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    lockedJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", PriceMapTransformer)
    pricesJSON!: PriceMap;

    constructor(
        time: number | undefined,
        volumeJSON: VolumeMap | undefined,
        lockedJSON: VolumeMap | undefined,
        pricesJSON: PriceMap | undefined
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.volumeJSON = volumeJSON || OrderedMap();
        this.lockedJSON = lockedJSON || OrderedMap();
        this.pricesJSON = pricesJSON || OrderedMap();
    }
}

export const getTimestamp = (time: Moment | number): number => {
    const unix = typeof time === "number" ? time : time.unix();
    return unix - (unix % TIME_BLOCK_LENGTH);
};

export const getTimeBlock = async (timestamp: Moment | number) => {
    const unixTimestamp =
        typeof timestamp === "number" ? timestamp : timestamp.unix();

    let timeBlock = await TimeBlock.findOne({
        timestamp: getTimestamp(unixTimestamp),
    });
    if (!timeBlock) {
        // Get latest TimeBlock before timestamp.
        const previousTimeBlock: TimeBlock | undefined =
            await TimeBlock.findOne({
                where: {
                    timestamp: LessThan(unixTimestamp),
                },
                order: {
                    timestamp: "DESC",
                },
            });

        if (DEBUG) {
            console.log(
                red(
                    `Creating new ${TimeBlock.name} ${unixTimestamp} ${
                        previousTimeBlock
                            ? `based on ${previousTimeBlock?.timestamp}`
                            : `(first timeblock!)`
                    }`
                )
            );
        }

        timeBlock = new TimeBlock(
            unixTimestamp,
            previousTimeBlock ? previousTimeBlock.volumeJSON : undefined,
            previousTimeBlock ? previousTimeBlock.lockedJSON : undefined,
            previousTimeBlock ? previousTimeBlock.pricesJSON : undefined
        );
    }

    return timeBlock;
};

export const addVolume = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.volumeJSON = partialTimeBlock.volumeJSON.set(
        selector,
        addToTokenAmount(
            partialTimeBlock.volumeJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

const assertAmountIsValid = (amount: TokenAmount) => {
    if (amount.amount.isNaN()) {
        throw new Error(
            `Invalid volume amount 'amount' in assertAmountIsValid.`
        );
    }
    if (amount.amountInEth.isNaN()) {
        throw new Error(
            `Invalid volume amount 'amountInEth' in assertAmountIsValid.`
        );
    }
    if (amount.amountInBtc.isNaN()) {
        throw new Error(
            `Invalid volume amount 'amountInBtc' in assertAmountIsValid.`
        );
    }
    if (amount.amountInUsd.isNaN()) {
        throw new Error(
            `Invalid volume amount 'amountInUsd' in assertAmountIsValid.`
        );
    }

    return true;
};

export const setLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount
) => {
    assertAmountIsValid(amount);

    partialTimeBlock.lockedJSON = partialTimeBlock.lockedJSON.set(
        selector,
        amount
    );

    return partialTimeBlock;
};

export const addLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.lockedJSON = partialTimeBlock.lockedJSON.set(
        selector,
        addToTokenAmount(
            partialTimeBlock.lockedJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice,
            true
        )
    );

    return partialTimeBlock;
};

export const subtractLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.lockedJSON = partialTimeBlock.lockedJSON.set(
        selector,
        subtractFromTokenAmount(
            partialTimeBlock.lockedJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export const updateTokenPrice = async <T extends PartialTimeBlock>(
    timeBlock: T,
    asset: string,
    timestamp: Moment
): Promise<T> => {
    let newTokenPrice: TokenPrice | undefined = undefined;
    try {
        newTokenPrice = await getTokenPrice(asset, timestamp);
    } catch (error) {
        console.error(extractError(error, "Unable to get token price."));
    }

    timeBlock.pricesJSON = timeBlock.pricesJSON.set(asset, {
        decimals: 0,
        priceInEth: 0,
        priceInBtc: 0,
        priceInUsd: 0,
        ...timeBlock.pricesJSON.get(asset),
        ...newTokenPrice,
    });

    return timeBlock;
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
