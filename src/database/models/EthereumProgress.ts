import { Field, ID, Int, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";

@Entity()
@ObjectType()
export class EthereumProgress extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    _id: number | null = null;

    @Field(() => Int)
    @Column()
    syncedBlock: number = 0;

    constructor(ethereumSyncedBlock: number) {
        super();

        this.syncedBlock = ethereumSyncedBlock;
    }
}
