import { Mutex } from "async-mutex";
import { RenVMInstances } from "../database/models";
import { TIME_BLOCK_LENGTH } from "../database/models/TimeBlock";

export class NetworkSync {
    mutex: Mutex;

    "mainnet": boolean = false;
    "mainnet-v0.3": boolean = false;
    "testnet": boolean = false;
    "testnet-v0.3": boolean = false;

    timestamp: number;
    initialTimestamp: number;
    log: boolean;

    constructor(log: boolean = false) {
        this.mutex = new Mutex();
        this.timestamp = 0;
        this.initialTimestamp = 0;
        this.log = log;
    }

    public upTo = async (
        network: RenVMInstances,
        timestamp: number
    ): Promise<[boolean, number]> => {
        const otherNetwork =
            network === RenVMInstances.Mainnet
                ? this[RenVMInstances.MainnetVDot3] &&
                  this[RenVMInstances.Testnet] &&
                  this[RenVMInstances.TestnetVDot3]
                : network === RenVMInstances.MainnetVDot3
                ? this[RenVMInstances.Mainnet] &&
                  this[RenVMInstances.Testnet] &&
                  this[RenVMInstances.TestnetVDot3]
                : network === RenVMInstances.Testnet
                ? this[RenVMInstances.Mainnet] &&
                  this[RenVMInstances.MainnetVDot3] &&
                  this[RenVMInstances.TestnetVDot3]
                : network === RenVMInstances.TestnetVDot3
                ? this[RenVMInstances.Mainnet] &&
                  this[RenVMInstances.MainnetVDot3] &&
                  this[RenVMInstances.Testnet]
                : false;

        await this.mutex.acquire();

        // if (this.log) {
        //     console.log(
        //         network,
        //         `upTo(${network}, ${timestamp}): ${this.timestamp}, ${this.initialTimestamp}, ${this[network]}, ${this[otherNetwork]}`
        //     );
        // }

        if (this.timestamp === 0) {
            if (this.initialTimestamp && otherNetwork) {
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

        if (timestamp > this.timestamp && this[network] && otherNetwork) {
            this.timestamp =
                this.timestamp > 0
                    ? this.timestamp + TIME_BLOCK_LENGTH
                    : timestamp;

            this[RenVMInstances.Mainnet] = false;
            this[RenVMInstances.MainnetVDot3] = false;
            this[RenVMInstances.Testnet] = false;
            this[RenVMInstances.TestnetVDot3] = false;

            this[network] = true;

            this.mutex.release();
            return [false, this.timestamp];
        }

        this.mutex.release();

        return [
            timestamp <= this.timestamp ||
                (timestamp >= this.timestamp && otherNetwork),
            this.timestamp,
        ];
    };
}
