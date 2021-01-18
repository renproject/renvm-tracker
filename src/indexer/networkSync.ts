import { Mutex } from "async-mutex";
import { TIME_BLOCK_LENGTH } from "../database/models/TimeBlock";

export class NetworkSync {
    mutex: Mutex;

    "v0.2": boolean = false;
    "v0.3": boolean = false;
    timestamp: number;
    initialTimestamp: number;

    constructor(log: boolean = false) {
        this.mutex = new Mutex();
        this.timestamp = 0;
        this.initialTimestamp = 0;
    }

    public upTo = async (
        network: "v0.2" | "v0.3",
        timestamp: number
    ): Promise<[boolean, number]> => {
        const otherNetwork = network === "v0.2" ? "v0.3" : "v0.2";

        await this.mutex.acquire();

        if (this.timestamp === 0) {
            if (this.initialTimestamp && this[otherNetwork]) {
                this.timestamp = Math.min(timestamp, this.initialTimestamp);
            } else {
                this.initialTimestamp = timestamp;
            }
        }

        if (timestamp >= this.timestamp && !this[network]) {
            this[network] = true;
            this.mutex.release();
            return [false, this.timestamp];
        }

        if (timestamp > this.timestamp && this[network] && this[otherNetwork]) {
            this.timestamp =
                this.timestamp > 0
                    ? this.timestamp + TIME_BLOCK_LENGTH
                    : timestamp;
            this[otherNetwork] = false;
            this[network] = true;

            this.mutex.release();
            return [true, this.timestamp];
        }

        this.mutex.release();

        return [
            this.timestamp >= timestamp && this[otherNetwork] && this[network],
            this.timestamp,
        ];
    };
}
