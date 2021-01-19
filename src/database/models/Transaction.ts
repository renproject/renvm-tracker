import { Field, ID, Int, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { RenVMInstances } from "./RenVMInstance";

import { RenNetwork } from "./TimeBlock";

@Entity()
@ObjectType()
@Unique(["name"])
export class Transaction extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => String)
    @Column()
    symbol!: string;

    @Field(() => Int)
    @Column()
    amount!: string;

    @Field(() => String)
    @Column()
    network!: RenNetwork;

    @Field(() => String)
    @Column()
    renVMNetwork!: RenVMInstances;

    @Field(() => Number)
    @Column()
    timestamp!: number;

    @Field(() => Number)
    @Column()
    block!: number;

    constructor(
        symbol: string,
        amount: string,
        network: RenNetwork,
        renVMNetwork: RenVMInstances,
        timestamp: number,
        block: number
    ) {
        super();

        this.symbol = symbol;
        this.amount = amount;
        this.network = network;
        this.renVMNetwork = renVMNetwork;
        this.timestamp = timestamp;
        this.block = block;
    }
}
