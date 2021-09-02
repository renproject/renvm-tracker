import { Field, ID, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@ObjectType()
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

    @Field(() => Boolean)
    @Column()
    initialized: boolean = false;

    constructor() {
        super();
    }
}
