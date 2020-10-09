import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Chain } from "./Chain";

@Entity()
@ObjectType()
export class Asset extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => String)
    @Column()
    name: string = "";

    @Field(() => Chain)
    @ManyToOne((chain) => Chain, (chain) => chain, { eager: true })
    chain!: Chain;

    constructor(chain: Chain) {
        super();
        this.chain = chain;
    }
}
