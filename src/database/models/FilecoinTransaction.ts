import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";

import { Asset } from "./Asset";
import { Chain } from "./Chain";

export enum FilecoinNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

@Entity()
@ObjectType()
@Unique(["cid"])
export class FilecoinTransaction extends BaseEntity {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => Chain)
    @ManyToOne((chain) => Chain, (chain) => chain, { eager: true })
    chain!: Chain;

    @Field(() => Asset)
    @ManyToOne((asset) => Asset, (asset) => asset, { eager: true })
    asset!: Asset;

    @Field(() => String)
    @Column()
    cid!: string;

    @Field(() => String)
    @Column()
    to!: string;

    @Field(() => String)
    @Column()
    amount!: string;

    @Field(() => String)
    @Column()
    params!: string;

    @Field(() => Number)
    @Column()
    blocknumber!: number;

    @Field(() => Number)
    @Column()
    nonce!: number;

    @Field(() => String)
    @Column()
    network!: FilecoinNetwork;

    constructor(
        chain: Chain,
        asset: Asset,
        args: {
            cid: string;
            to: string;
            amount: string;
            params: string;
            blocknumber: number;
            nonce: number;
        },
    ) {
        super();
        if (args) {
            this.asset = asset;
            this.chain = chain;
            // this.id = args.cid || "";

            this.cid = args.cid || "";
            this.to = args.to || "";
            this.amount = args.amount || "";
            this.params = args.params || "";
            this.blocknumber = args.blocknumber || 0;
            this.nonce = args.nonce || 0;
            this.network =
                (chain.network as FilecoinNetwork) || FilecoinNetwork.Mainnet;
        }
    }
}
