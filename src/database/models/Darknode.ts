import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { JSONTransformer } from "./common";

@ObjectType()
export class DarknodeWithdrawal {
    @Field(() => Number)
    timestamp: number;

    constructor(timestamp: number) {
        this.timestamp = timestamp;
    }
}

@ObjectType()
export class RegistrationInterval {
    @Field(() => Number)
    registeredAt: number;

    @Field(() => Number)
    deregisteredAt: number;

    @Field(() => Number)
    refundedAt: number;

    constructor(
        registeredAt: number,
        deregisteredAt: number,
        refundedAt: number
    ) {
        this.registeredAt = registeredAt;
        this.deregisteredAt = deregisteredAt;
        this.refundedAt = refundedAt;
    }
}

@Entity()
@ObjectType()
@Unique(["address", "id"])
export class Darknode extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    _id: number | null = null;

    @Field(() => String)
    @Column()
    darknodeID: string;

    @Field(() => String)
    @Column()
    darknodeAddress: string;

    @Field(() => String)
    @Column()
    operatorAddress: string;

    @Field(() => [DarknodeWithdrawal])
    @Column("varchar", JSONTransformer)
    withdrawals: DarknodeWithdrawal[];

    @Field(() => [RegistrationInterval])
    @Column("varchar", JSONTransformer)
    registrations: RegistrationInterval[];

    constructor(
        darknodeID: string,
        darknodeAddress: string,
        operatorAddress: string,
        withdrawals: DarknodeWithdrawal[],
        registrations: RegistrationInterval[]
    ) {
        super();

        this.darknodeID = darknodeID;
        this.darknodeAddress = darknodeAddress;
        this.operatorAddress = operatorAddress;
        this.withdrawals = withdrawals;
        this.registrations = registrations;
    }
}
