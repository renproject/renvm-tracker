import { Field, ID, Int, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { RenNetwork } from "../../networks";

@Entity()
@ObjectType()
@Unique(["network"])
export class RenVMProgress extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    _id: number | null = null;

    @Field(() => Int)
    @Column()
    syncedBlock: number = 0;

    @Field(() => Int)
    @Column()
    migrationCount: number = 0;

    constructor() {
        super();
    }
}
