import { Field, ID, Int, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";

import { RenNetwork } from "./TimeBlock";

export enum RenVMInstances {
    Mainnet = "mainnet",
    MainnetVDot3 = "mainnet-v0.3",
    Testnet = "testnet",
    TestnetVDot3 = "testnet-v0.3",
}

@Entity()
@ObjectType()
@Unique(["name"])
export class RenVMInstance extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => String)
    @Column()
    name!: RenVMInstances;

    @Field(() => Int)
    @Column()
    syncedBlock: number = 0;

    @Field(() => Int)
    @Column()
    migrationCount: number = 0;

    @Field(() => String)
    @Column()
    network!: RenNetwork;

    constructor(name: RenVMInstances, network: RenNetwork) {
        super();

        this.name = name;
        this.migrationCount = 0;
        this.network = network;
    }
}
