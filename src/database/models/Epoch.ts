import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { JSONTransformer } from "./common";
import { AssetAmount } from "./Snapshot";

@Entity()
@ObjectType()
@Unique(["epochIndex", "epochHash"])
export class Epoch extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    _id: number | null = null;

    @Field(() => Number)
    @Column()
    epochIndex: number;

    @Field(() => String)
    @Column()
    epochHash: string;

    @Field(() => Number)
    @Column()
    timestamp: number;

    @Field(() => Number)
    @Column()
    darknodeCount: number;

    @Field(() => Number)
    @Column()
    registeringNextEpoch: number;

    @Field(() => Number)
    @Column()
    deregisteringNextEpoch: number;

    @Field(() => [AssetAmount])
    @Column("varchar", JSONTransformer)
    rewards: AssetAmount[];

    @Field(() => [AssetAmount])
    @Column("varchar", JSONTransformer)
    fund: AssetAmount[];

    constructor(
        epochIndex: number,
        epochHash: string,
        timestamp: number,
        darknodeCount: number,
        registeringNextEpoch: number,
        deregisteringNextEpoch: number,
        rewards: AssetAmount[],
        fund: AssetAmount[]
    ) {
        super();

        this.epochIndex = epochIndex;
        this.epochHash = epochHash;
        this.timestamp = timestamp;
        this.darknodeCount = darknodeCount;
        this.registeringNextEpoch = registeringNextEpoch;
        this.deregisteringNextEpoch = deregisteringNextEpoch;
        this.rewards = rewards;
        this.fund = fund;
    }
}
