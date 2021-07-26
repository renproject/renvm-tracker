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
import { ColumnCommonOptions } from "typeorm/decorator/options/ColumnCommonOptions";

export const TIME_BLOCK_LENGTH = 300; // 5 minutes

export const getTimestamp = (time: Moment | number): number => {
    const unix = typeof time === "number" ? time : time.unix();
    return unix - (unix % TIME_BLOCK_LENGTH);
};

@ObjectType()
export class AssetAmount {
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

export const JSONTransformer: ColumnCommonOptions = {
    transformer: {
        to: JSON.stringify,
        from: JSON.parse,
    },
};

@Entity()
@ObjectType()
@Unique(["timestamp"])
export class Snapshot extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => Number)
    @Column()
    timestamp: number;

    @Field(() => [AssetAmount])
    @Column("varchar", JSONTransformer)
    volume: AssetAmount[];

    @Field(() => [AssetAmount])
    @Column("varchar", JSONTransformer)
    locked: AssetAmount[];

    @Field(() => [AssetPrice])
    @Column("varchar", JSONTransformer)
    prices: AssetPrice[];

    constructor(
        time: number | undefined,
        volume: AssetAmount[],
        locked: AssetAmount[],
        prices: AssetPrice[]
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.volume = volume;
        this.locked = locked;
        this.prices = prices;
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
            volume: AssetAmount[];
            locked: AssetAmount[];
            prices: AssetPrice[];
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
        };

        snapshot = new Snapshot(
            timestamp,
            previousSnapshot.volume,
            previousSnapshot.locked,
            previousSnapshot.prices
        );
    }

    return snapshot;
};
