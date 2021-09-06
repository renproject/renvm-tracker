import { Args, ArgsType, Field, Query, Resolver } from "type-graphql";
import { LessThanOrEqual } from "typeorm";

import { Snapshot } from "../../database/models";

@ArgsType()
class SnapshotFilter {
    @Field(() => String, { nullable: true, defaultValue: "" })
    timestamp?: string;
}

@Resolver()
export class Resolvers {
    @Query(() => Snapshot)
    async Snapshot(@Args() where: SnapshotFilter): Promise<Snapshot> {
        try {
            let timestamp = where.timestamp;
            if (!timestamp || timestamp === "latest" || timestamp === "") {
                timestamp = Math.floor(Date.now() / 1000).toString();
            }
            const snapshot = await Snapshot.findOneOrFail({
                where: {
                    timestamp: LessThanOrEqual(timestamp),
                },
                order: {
                    timestamp: "DESC",
                },
            });
            snapshot.id = 0;
            return snapshot;
        } catch (error) {
            throw new Error(
                `Snapshot less than or equal to ${where.timestamp} not found.`
            );
        }
    }
}
