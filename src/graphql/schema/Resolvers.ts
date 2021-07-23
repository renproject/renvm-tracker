import { Args, ArgsType, Field, Query, Resolver } from "type-graphql";
import { LessThanOrEqual } from "typeorm";

import { Snapshot } from "../../database/models";

@ArgsType()
class SnapshotFilter {
    @Field(() => String, { nullable: true })
    timestamp?: number;
}

@Resolver()
export class Resolvers {
    @Query(() => Snapshot)
    async Snapshot(@Args() where: SnapshotFilter): Promise<Snapshot> {
        try {
            return await Snapshot.findOneOrFail({
                where: {
                    timestamp: LessThanOrEqual(where.timestamp),
                },
                order: {
                    timestamp: "DESC",
                },
            });
        } catch (error) {
            throw new Error(
                `Snapshot less than or equal to ${where.timestamp} not found.`
            );
        }
    }
}
