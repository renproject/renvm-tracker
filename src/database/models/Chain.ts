import { Field, ID, Int, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@ObjectType()
export class Chain extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => String)
    @Column()
    name!: string;

    @Field(() => String)
    @Column()
    network!: string;

    @Field(() => Int)
    @Column()
    synced: number = 0;

    constructor(name: string, network: string) {
        super();

        this.name = name;
        this.network = network;
    }
}
