import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
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
export class TokenAmount {
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
export class TokenPrice {
    @Field(() => String)
    token: string;
    @Field(() => Number)
    decimals: number;
    @Field(() => Number)
    priceInEth: number;
    @Field(() => Number)
    priceInBtc: number;
    @Field(() => Number)
    priceInUsd: number;

    constructor(
        token: string,
        decimals: number,
        priceInEth: number,
        priceInBtc: number,
        priceInUsd: number
    ) {
        this.token = token;
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

    @Field(() => [TokenAmount])
    @Column("varchar", JSONTransformer)
    volume: TokenAmount[];

    @Field(() => [TokenAmount])
    @Column("varchar", JSONTransformer)
    locked: TokenAmount[];

    @Field(() => [TokenPrice])
    @Column("varchar", JSONTransformer)
    prices: TokenPrice[];

    constructor(
        time: number | undefined,
        volume: TokenAmount[],
        locked: TokenAmount[],
        prices: TokenPrice[]
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.volume = volume;
        this.locked = locked;
        this.prices = prices;
    }
}
