import { ObjectType } from "type-graphql";
import { Entity, Unique } from "typeorm";

import { TimeBlock } from "./TimeBlock";

@Entity()
@ObjectType()
@Unique(["timestamp"])
export class TimeBlockV2 extends TimeBlock {}
