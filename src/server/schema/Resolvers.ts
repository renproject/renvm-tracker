import { Arg, Args, ArgsType, Field, Int, Query, Resolver } from "type-graphql";
import { FindConditions } from "typeorm";

import { Asset, Chain, FilecoinTransaction } from "../../database/models";
import { getIndexers } from "../server";

// const Transaction = createUnionType({
//     name: "Transaction",
//     types: () => [FilecoinTransaction] as const,
// });

@ArgsType()
class ChainFilter {
    @Field((type) => String, { nullable: true })
    name?: FindConditions<Chain>["name"];
}

@ArgsType()
class AssetFilter {
    @Field((type) => String, { nullable: true })
    name?: FindConditions<Asset>["name"];
}

@ArgsType()
class FilecoinTransactionFilter {
    @Field((type) => String, { nullable: true })
    cid?: FindConditions<FilecoinTransaction>["cid"];

    @Field((type) => String, { nullable: true })
    to?: FindConditions<FilecoinTransaction>["to"];

    @Field((type) => String, { nullable: true })
    amount?: FindConditions<FilecoinTransaction>["amount"];

    @Field((type) => String, { nullable: true })
    params?: FindConditions<FilecoinTransaction>["params"];

    @Field((type) => Number, { nullable: true })
    blocknumber?: FindConditions<FilecoinTransaction>["blocknumber"];

    @Field((type) => Number, { nullable: true })
    nonce?: FindConditions<FilecoinTransaction>["nonce"];
}

@Resolver()
export class Resolvers {
    @Query(() => [Chain])
    async Chains(@Args() where: ChainFilter): Promise<Chain[]> {
        return await Chain.find(where);
    }

    @Query(() => [Asset])
    async Assets(@Args() where: AssetFilter): Promise<Asset[]> {
        return await Asset.find(where);
    }

    @Query(() => [FilecoinTransaction])
    async FilecoinTransactions(
        @Args() where: FilecoinTransactionFilter,
    ): Promise<FilecoinTransaction[]> {
        return await FilecoinTransaction.find(where);
    }

    @Query(() => Int)
    async NetworkHeight(
        @Arg("chain") chain: string,
        @Arg("network") network: string,
    ): Promise<number> {
        const indexers = getIndexers();
        if (!indexers) {
            throw new Error(`Unable to fetch transaction`);
        }

        // Update transaction.
        const height = await indexers[chain][
            network as string
        ].getLatestHeight();

        return height;
    }
}
