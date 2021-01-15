import { Field, ID, ObjectType } from "type-graphql";
import {
    BaseEntity,
    Column,
    Connection,
    Entity,
    LessThan,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { Mutex } from "async-mutex";
import { parseV1Selector } from "@renproject/utils";

import { Moment } from "moment";
import {
    addToTokenAmount,
    subtractFromTokenAmount,
    PriceMap,
    PriceMapTransformer,
    TokenAmountZero,
    TokenPrice,
    VolumeMap,
    VolumeMapTransformer,
    TokenAmount,
} from "./amounts";
import { List, OrderedMap } from "immutable";
import { RenVMInstance } from "./RenVMInstance";

export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

export const TIME_BLOCK_LENGTH = 300;

export interface PartialTimeBlock {
    mainnetVolumeJSON: VolumeMap;
    testnetVolumeJSON: VolumeMap;
    mainnetLockedJSON: VolumeMap;
    testnetLockedJSON: VolumeMap;
    pricesJSON: PriceMap;
}

export const defaultPartialTimeBlock: PartialTimeBlock = {
    mainnetVolumeJSON: OrderedMap(),
    testnetVolumeJSON: OrderedMap(),
    mainnetLockedJSON: OrderedMap(),
    testnetLockedJSON: OrderedMap(),
    pricesJSON: OrderedMap(),
};

@Entity()
@ObjectType()
@Unique(["timestamp"])
export class TimeBlock extends BaseEntity implements PartialTimeBlock {
    @Field(() => ID)
    @PrimaryGeneratedColumn()
    id: number | null = null;

    @Field(() => Number)
    @Column()
    timestamp!: number;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    mainnetVolumeJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    testnetVolumeJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    mainnetLockedJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    testnetLockedJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", PriceMapTransformer)
    pricesJSON!: PriceMap;

    constructor(
        time: number | undefined,
        mainnetVolumeJSON: VolumeMap | undefined,
        testnetVolumeJSON: VolumeMap | undefined,
        mainnetLockedJSON: VolumeMap | undefined,
        testnetLockedJSON: VolumeMap | undefined,
        pricesJSON: PriceMap | undefined
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.mainnetVolumeJSON = mainnetVolumeJSON || OrderedMap();
        this.testnetVolumeJSON = testnetVolumeJSON || OrderedMap();
        this.mainnetLockedJSON = mainnetLockedJSON || OrderedMap();
        this.testnetLockedJSON = testnetLockedJSON || OrderedMap();
        this.pricesJSON = pricesJSON || OrderedMap();
    }
}

const mutex = new Mutex();

export const getTimestamp = (time: Moment | number) => {
    const unix = typeof time === "number" ? time : time.unix();
    return unix - (unix % TIME_BLOCK_LENGTH);
};

const getTimeBlock = async (timestamp: Moment | number) => {
    const unixTimestamp =
        typeof timestamp === "number" ? timestamp : timestamp.unix();

    let timeBlock = await TimeBlock.findOne({
        timestamp: getTimestamp(unixTimestamp),
    });
    if (!timeBlock) {
        // Get latest TimeBlock before timestamp.
        const previousTimeBlock:
            | TimeBlock
            | undefined = await TimeBlock.findOne({
            where: {
                timestamp: LessThan(unixTimestamp),
            },
            order: {
                timestamp: "DESC",
            },
        });

        timeBlock = new TimeBlock(
            unixTimestamp,
            previousTimeBlock ? previousTimeBlock.mainnetVolumeJSON : undefined,
            previousTimeBlock ? previousTimeBlock.testnetVolumeJSON : undefined,
            previousTimeBlock ? previousTimeBlock.mainnetLockedJSON : undefined,
            previousTimeBlock ? previousTimeBlock.testnetLockedJSON : undefined,
            previousTimeBlock ? previousTimeBlock.pricesJSON : undefined
        );
        await timeBlock.save();
    }

    return timeBlock;
};

export const addVolume = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    network: RenNetwork,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    const volumeKey =
        network === "mainnet" ? "mainnetVolumeJSON" : "testnetVolumeJSON";

    partialTimeBlock[volumeKey] = partialTimeBlock[volumeKey].set(
        selector,
        addToTokenAmount(
            partialTimeBlock[volumeKey].get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export const addLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    network: RenNetwork,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    const lockedKey =
        network === "mainnet" ? "mainnetLockedJSON" : "testnetLockedJSON";

    partialTimeBlock[lockedKey] = partialTimeBlock[lockedKey].set(
        selector,
        addToTokenAmount(
            partialTimeBlock[lockedKey].get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export const subtractLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    network: RenNetwork,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    const lockedKey =
        network === "mainnet" ? "mainnetLockedJSON" : "testnetLockedJSON";

    partialTimeBlock[lockedKey] = partialTimeBlock[lockedKey].set(
        selector,
        subtractFromTokenAmount(
            partialTimeBlock[lockedKey].get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export enum MintOrBurn {
    MINT,
    BURN,
}

const v1ChainMap = OrderedMap<string, string>().set("Eth", "Ethereum");

export const parseSelector = (
    selector: string
): { asset: string; token: string; mintOrBurn: MintOrBurn } => {
    const v2SelectorMatch = /^([A-Z]+)\/(from|to)(.+)$/.exec(selector);
    if (v2SelectorMatch) {
        const [_, asset, toOrFrom, chain] = v2SelectorMatch;
        return {
            asset,
            token: `${asset.toUpperCase()}/${chain}`,
            mintOrBurn: toOrFrom === "to" ? MintOrBurn.MINT : MintOrBurn.BURN,
        };
    }

    const { asset, from, to } = parseV1Selector(selector);
    const isMint = asset === from.toUpperCase();
    const mintChain: string = v1ChainMap.get(
        isMint ? to : from,
        isMint ? to : from
    );
    return {
        asset,
        token: `${asset.toUpperCase()}/${mintChain}`,
        mintOrBurn: isMint ? MintOrBurn.MINT : MintOrBurn.BURN,
    };
};

const updateTimeBlock = (
    timeBlock: TimeBlock,
    partialTimeBlock: PartialTimeBlock,
    network: RenNetwork
) => {
    const volumeKey =
        network === "mainnet" ? "mainnetVolumeJSON" : "testnetVolumeJSON";
    const lockedKey =
        network === "mainnet" ? "mainnetLockedJSON" : "testnetLockedJSON";

    timeBlock.pricesJSON = partialTimeBlock.pricesJSON;

    for (const [selector, amount] of partialTimeBlock[volumeKey]) {
        const asset = selector.split("/")[0];
        timeBlock = addVolume(
            timeBlock,
            network,
            selector,
            amount,
            partialTimeBlock.pricesJSON.get(asset, undefined)
        );
    }

    for (const [selector, amount] of partialTimeBlock[lockedKey]) {
        const asset = selector.split("/")[0];
        timeBlock = addLocked(
            timeBlock,
            network,
            selector,
            amount,
            partialTimeBlock.pricesJSON.get(asset, undefined)
        );
    }

    return timeBlock;
};

export const updateTimeBlocks = async (
    partialTimeBlocks: OrderedMap<number, PartialTimeBlock>,
    renVM: RenVMInstance,
    connection: Connection
) => {
    await mutex.acquire();

    try {
        let timeblocks = List<TimeBlock>();

        for (const [timestamp, partialTimeBlock] of partialTimeBlocks) {
            timeblocks = timeblocks.push(
                updateTimeBlock(
                    await getTimeBlock(timestamp),
                    partialTimeBlock,
                    renVM.network
                )
            );
        }

        await connection.manager.save([...timeblocks.toArray(), renVM]);
    } finally {
        mutex.release();
    }
};
