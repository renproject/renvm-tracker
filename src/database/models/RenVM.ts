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
@Unique(["name"])
export class RenVM extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => Int)
    @Column()
    syncedBlock: number = 0;

    @Field(() => Int)
    @Column()
    migrationCount: number = 0;

    @Field(() => String)
    @Column()
    network: RenNetwork;

    constructor(network: RenNetwork) {
        super();

        this.migrationCount = 0;
        this.network = network;
    }
}
