import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    LessThan,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { Moment } from "moment";
import moment from "moment";

import { JSONTransformer } from "./common";

export const TIME_BLOCK_LENGTH = 300; // 5 minutes

export const getTimestamp = (time: Moment | number): number => {
    const unix = typeof time === "number" ? time : time.unix();
    return unix - (unix % TIME_BLOCK_LENGTH);
};

@ObjectType()
export class AssetAmount {
    @Field(() => String)
    asset: string;
    @Field(() => String)
    amount: string;
    @Field(() => String)
    amountInEth: string;
    @Field(() => String)
    amountInBtc: string;
    @Field(() => String)
    amountInUsd: string;

    constructor(
        asset: string,
        amount: string,
        amountInEth: string,
        amountInBtc: string,
        amountInUsd: string
    ) {
        this.asset = asset;
        this.amount = amount;
        this.amountInEth = amountInEth;
        this.amountInBtc = amountInBtc;
        this.amountInUsd = amountInUsd;
    }
}

@ObjectType()
export class AssetAmountWithChain {
    @Field(() => String)
    chain: string;
    @Field(() => String)
    asset: string;
    @Field(() => String)
    amount: string;
    @Field(() => String)
    amountInEth: string;
    @Field(() => String)
    amountInBtc: string;
    @Field(() => String)
    amountInUsd: string;

    constructor(
        chain: string,
        asset: string,
        amount: string,
        amountInEth: string,
        amountInBtc: string,
        amountInUsd: string
    ) {
        this.chain = chain;
        this.asset = asset;
        this.amount = amount;
        this.amountInEth = amountInEth;
        this.amountInBtc = amountInBtc;
        this.amountInUsd = amountInUsd;
    }
}

@ObjectType()
export class AssetPrice {
    @Field(() => String)
    asset: string;
    @Field(() => Number)
    decimals: number;
    @Field(() => Number)
    priceInEth: number;
    @Field(() => Number)
    priceInBtc: number;
    @Field(() => Number)
    priceInUsd: number;

    constructor(
        asset: string,
        decimals: number,
        priceInEth: number,
        priceInBtc: number,
        priceInUsd: number
    ) {
        this.asset = asset;
        this.decimals = decimals;
        this.priceInEth = priceInEth;
        this.priceInBtc = priceInBtc;
        this.priceInUsd = priceInUsd;
    }
}

// Convert a unix timestamp to a human-readable representation. Seconds are not
// included.
// e.g. timestampString(1627611153) = "2021 July 30th, 2:12am (UTC)"
const timestampString = (timestamp: number): string =>
    moment(timestamp * 1000)
        .utc()
        .format("YYYY MMMM Do, h:mma (UTC)");

@Entity()
@ObjectType()
@Unique(["timestamp"])
export class Snapshot extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    _id: number | null = null;

    @Field(() => Number)
    @Column()
    timestamp: number;

    @Field(() => String)
    @Column("varchar")
    timestampString: string;

    @Field(() => [AssetAmountWithChain])
    @Column("varchar", JSONTransformer)
    volume: AssetAmountWithChain[];

    @Field(() => [AssetAmountWithChain])
    @Column("varchar", JSONTransformer)
    locked: AssetAmountWithChain[];

    @Field(() => [AssetPrice])
    @Column("varchar", JSONTransformer)
    prices: AssetPrice[];

    @Field(() => [AssetAmount])
    @Column("varchar", JSONTransformer)
    fees: AssetAmount[];

    constructor(
        time: number | undefined,
        volume: AssetAmountWithChain[],
        locked: AssetAmountWithChain[],
        prices: AssetPrice[],
        fees: AssetAmount[]
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.timestampString = timestampString(this.timestamp);
        this.volume = volume;
        this.locked = locked;
        this.prices = prices;
        this.fees = fees;
    }
}

/**
 * Look up the snapshot for the provided timestamp. If
 */
export const getSnapshot = async (timestampMoment: Moment) => {
    const timestamp = getTimestamp(timestampMoment);

    let snapshot = await Snapshot.findOne({
        timestamp: timestamp,
    });
    if (!snapshot) {
        // Get latest Snapshot before timestamp.
        const previousSnapshot: {
            volume: AssetAmountWithChain[];
            locked: AssetAmountWithChain[];
            prices: AssetPrice[];
            fees: AssetAmount[];
        } = (await Snapshot.findOne({
            where: {
                timestamp: LessThan(timestamp),
            },
            order: {
                timestamp: "DESC",
            },
        })) || {
            volume: [],
            locked: [],
            prices: [],
            fees: [],
        };

        snapshot = new Snapshot(
            timestamp,
            previousSnapshot.volume,
            previousSnapshot.locked,
            previousSnapshot.prices,
            previousSnapshot.fees
        );
    }

    return snapshot;
};
