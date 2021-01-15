import { Args, ArgsType, Field, Query, Resolver } from "type-graphql";
import { FindConditions } from "typeorm";

import { RenVMInstance, TimeBlock } from "../../database/models";

@ArgsType()
class RenVMInstanceFilter {
    @Field(() => String, { nullable: true })
    name?: FindConditions<RenVMInstance>["name"];
}

@ArgsType()
class TimeBlockFilter {
    @Field(() => String, { nullable: true })
    timestamp?: FindConditions<TimeBlock>["timestamp"];
}

@Resolver()
export class Resolvers {
    @Query(() => [RenVMInstance])
    async Chains(@Args() where: RenVMInstanceFilter): Promise<RenVMInstance[]> {
        return await RenVMInstance.find(where);
    }

    @Query(() => [TimeBlock])
    async Assets(@Args() where: TimeBlockFilter): Promise<TimeBlock[]> {
        return await TimeBlock.find(where);
    }
}
