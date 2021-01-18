export const _ = null;

// import { Field, ID, ObjectType } from "type-graphql";
// import {
//     BaseEntity,
//     Column,
//     Connection,
//     Entity,
//     LessThan,
//     PrimaryGeneratedColumn,
//     Unique,
// } from "typeorm";
// import { Mutex } from "async-mutex";
// import { parseV1Selector } from "@renproject/utils";

// import { Moment } from "moment";
// import {
//     addToTokenAmount,
//     subtractFromTokenAmount,
//     PriceMap,
//     PriceMapTransformer,
//     TokenAmountZero,
//     TokenPrice,
//     VolumeMap,
//     VolumeMapTransformer,
//     TokenAmount,
//     BigNumberTransformer,
// } from "./amounts";
// import { List, OrderedMap } from "immutable";
// import { RenVMInstance } from "./RenVMInstance";
// import BigNumber from "bignumber.js";

// export enum RenNetwork {
//     Mainnet = "mainnet",
//     Testnet = "testnet",
// }

// export const TIME_BLOCK_LENGTH = 300;

// export class RenTimeBlock {
//     public connection: Connection;
//     public table = "ren_time_block";

//     public timestamp: number;
//     public chains: {
//         [tokenOnChain: string]: {
//             volume: BigNumber;
//             locked: BigNumber;
//         };
//     };
//     public assets: {
//         [asset: string]: {
//             volume: BigNumber;
//             price: BigNumber;
//         };
//     };

//     constructor(connection: Connection, timestamp: number) {
//         this.connection = connection;
//         this.timestamp = timestamp;
//         this.chains = {};
//         this.assets = {};
//     }

//     public read = async (): Promise<RenTimeBlock> => {
//         return this;
//     }

//     public save = async (): Promise<RenTimeBlock> => {
//         const values: {
//             timestamp: number;
//             [key: string]: string | number;
//         } = {
//             timestamp: this.timestamp,
//         };

//         for (const chain of Object.keys(this.chains)) {
//             values[`${chain}_volume`] = this.chains[chain].volume.toFixed();
//             values[`${chain}_locked`] = this.chains[chain].locked.toFixed();
//         }

//         for (const asset of Object.keys(this.assets)) {
//             values[`${asset}_volume`] = this.assets[asset].volume.toFixed();
//             values[`${asset}_price`] = this.assets[asset].price.toFixed();
//         }

//         const existing = await this.connection
//             .createQueryBuilder()
//             .select(this.table)
//             .from("user", "user")
//             .where("user.timestamp = :timestamp", {
//                 timestamp: this.timestamp,
//             })
//             .getOne();

//         if (!existing) {
//             await this.connection.createQueryBuilder()
//                 .insert()
//                 .into(this.table)
//                 .values([
//                     { timestamp:  }
//                 ])
//         }

//         await this.connection
//             .createQueryBuilder()
//             .update(this.table)
//             .set(values);

//         return this;
//     };
// }
