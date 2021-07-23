import {
    Args,
    ArgsType,
    Field,
    ID,
    ObjectType,
    Query,
    Resolver,
} from "type-graphql";
import { LessThanOrEqual } from "typeorm";

import { TimeBlock } from "../../database/models";

@ObjectType()
abstract class Volume {
    @Field(() => String)
    token!: string;
    @Field(() => String)
    amount!: string;
    @Field(() => String)
    amountInEth!: string;
    @Field(() => String)
    amountInBtc!: string;
    @Field(() => String)
    amountInUsd!: string;
}

@ObjectType()
abstract class Price {
    @Field(() => String)
    token!: string;
    @Field(() => Number)
    decimals!: number;
    @Field(() => Number)
    priceInEth!: number;
    @Field(() => Number)
    priceInBtc!: number;
    @Field(() => Number)
    priceInUsd!: number;
}

@ObjectType()
abstract class SerializableTimeBlock {
    @Field(() => ID)
    id!: number | null;
    @Field(() => Number)
    timestamp!: number;

    @Field(() => [Volume])
    volume!: Volume[];

    @Field(() => [Volume])
    locked!: Volume[];

    @Field(() => [Price])
    prices!: Price[];
}

@ArgsType()
class TimeBlockFilter {
    @Field(() => String, { nullable: true })
    timestamp?: number;
}

@Resolver()
export class Resolvers {
    @Query(() => SerializableTimeBlock)
    async Snapshot(
        @Args() where: TimeBlockFilter
    ): Promise<SerializableTimeBlock> {
        try {
            const timeBlock = await TimeBlock.findOneOrFail({
                where: { timestamp: LessThanOrEqual(where.timestamp) },
                order: {
                    timestamp: "DESC",
                },
            });
            return {
                ...timeBlock,
                volume: timeBlock.volumeJSON
                    .map((x, token) => ({
                        token,
                        amount: x.amount.toFixed(),
                        amountInEth: x.amountInEth.toFixed(),
                        amountInBtc: x.amountInBtc.toFixed(),
                        amountInUsd: x.amountInUsd.toFixed(),
                    }))
                    .valueSeq()
                    .toArray(),
                locked: timeBlock.lockedJSON
                    .map((x, token) => ({
                        token,
                        amount: x.amount.toFixed(),
                        amountInEth: x.amountInEth.toFixed(),
                        amountInBtc: x.amountInBtc.toFixed(),
                        amountInUsd: x.amountInUsd.toFixed(),
                    }))
                    .valueSeq()
                    .toArray(),
                prices: timeBlock.pricesJSON
                    .map((x, token) => ({
                        token,
                        ...x,
                    }))
                    .valueSeq()
                    .toArray(),
            };
        } catch (error) {
            throw new Error(
                `Snapshot less than or equal to ${where.timestamp} not found.`
            );
        }
    }
}
