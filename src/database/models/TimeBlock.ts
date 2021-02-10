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
import { red, redBright } from "chalk";
import { TimeBlockV2 } from "./TimeBlockV2";

export enum RenNetwork {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

export const TIME_BLOCK_LENGTH = 300;

export interface PartialTimeBlock {
    volumeJSON: VolumeMap;
    lockedJSON: VolumeMap;
    pricesJSON: PriceMap;
}

export const defaultPartialTimeBlock: PartialTimeBlock = {
    volumeJSON: OrderedMap(),
    lockedJSON: OrderedMap(),
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
    volumeJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", VolumeMapTransformer)
    lockedJSON!: VolumeMap;

    @Field(() => String)
    @Column("varchar", PriceMapTransformer)
    pricesJSON!: PriceMap;

    constructor(
        time: number | undefined,
        volumeJSON: VolumeMap | undefined,
        lockedJSON: VolumeMap | undefined,
        pricesJSON: PriceMap | undefined
    ) {
        super();
        this.timestamp = time ? getTimestamp(time) : 0;
        this.volumeJSON = volumeJSON || OrderedMap();
        this.lockedJSON = lockedJSON || OrderedMap();
        this.pricesJSON = pricesJSON || OrderedMap();
    }
}

export const getTimestamp = (time: Moment | number): number => {
    const unix = typeof time === "number" ? time : time.unix();
    return unix - (unix % TIME_BLOCK_LENGTH);
};

export const getTimeBlock = async (
    TimeBlockVersion: typeof TimeBlock | typeof TimeBlockV2,
    timestamp: Moment | number
) => {
    const unixTimestamp =
        typeof timestamp === "number" ? timestamp : timestamp.unix();

    let timeBlock = await TimeBlockVersion.findOne({
        timestamp: getTimestamp(unixTimestamp),
    });
    if (!timeBlock) {
        // Get latest TimeBlock before timestamp.
        const previousTimeBlock:
            | TimeBlock
            | TimeBlockV2
            | undefined = await TimeBlockVersion.findOne({
            where: {
                timestamp: LessThan(unixTimestamp),
            },
            order: {
                timestamp: "DESC",
            },
        });

        console.log(
            red(
                `Creating new ${TimeBlockVersion.name} ${unixTimestamp} based on ${previousTimeBlock?.timestamp}`
            )
        );

        timeBlock = new TimeBlockVersion(
            unixTimestamp,
            previousTimeBlock ? previousTimeBlock.volumeJSON : undefined,
            previousTimeBlock ? previousTimeBlock.volumeJSON : undefined,
            previousTimeBlock ? previousTimeBlock.pricesJSON : undefined
        );
    }

    return timeBlock;
};

export const addVolume = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.volumeJSON = partialTimeBlock.volumeJSON.set(
        selector,
        addToTokenAmount(
            partialTimeBlock.volumeJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export const addLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.lockedJSON = partialTimeBlock.lockedJSON.set(
        selector,
        addToTokenAmount(
            partialTimeBlock.lockedJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice,
            true
        )
    );

    return partialTimeBlock;
};

export const subtractLocked = <T extends PartialTimeBlock>(
    partialTimeBlock: T,
    selector: string,
    amount: TokenAmount,
    tokenPrice: TokenPrice | undefined
) => {
    partialTimeBlock.lockedJSON = partialTimeBlock.lockedJSON.set(
        selector,
        subtractFromTokenAmount(
            partialTimeBlock.lockedJSON.get(selector, TokenAmountZero),
            amount,
            tokenPrice
        )
    );

    return partialTimeBlock;
};

export enum MintOrBurn {
    MINT = "MINT",
    BURN = "BURN",
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
    partialTimeBlock: PartialTimeBlock
) => {
    timeBlock.pricesJSON = timeBlock.pricesJSON.merge(
        partialTimeBlock.pricesJSON
    );

    for (const [selector, amount] of partialTimeBlock.volumeJSON) {
        const asset = selector.split("/")[0];
        timeBlock = addVolume(
            timeBlock,
            selector,
            amount,
            partialTimeBlock.pricesJSON.get(asset, undefined)
        );
    }

    for (const [selector, amount] of partialTimeBlock.lockedJSON) {
        const asset = selector.split("/")[0];
        timeBlock = addLocked(
            timeBlock,
            selector,
            amount,
            partialTimeBlock.pricesJSON.get(asset, undefined)
        );
    }

    return timeBlock;
};

export const updateTimeBlocks = async (
    TimeBlockVersion: typeof TimeBlock | typeof TimeBlockV2,
    partialTimeBlocks: OrderedMap<number, PartialTimeBlock>,
    renVM: RenVMInstance,
    connection: Connection,
    entities: any[]
) => {
    let timeblocks = List<TimeBlock>();

    for (const [timestamp, partialTimeBlock] of partialTimeBlocks) {
        const timeblock = updateTimeBlock(
            await getTimeBlock(TimeBlockVersion, timestamp),
            partialTimeBlock
        );
        timeblocks = timeblocks.push(timeblock);

        console.log(redBright(`Writing to block ${timeblock.timestamp}`));
    }

    await connection.manager.save([
        ...timeblocks.toArray(),
        ...entities,
        renVM,
    ]);
};
