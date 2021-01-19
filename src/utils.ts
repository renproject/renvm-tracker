import moment from "moment";
import { Moment } from "moment";

/**
 * Represents 1 second for functions that accept a parameter in milliseconds.
 */
export const SECONDS = 1000;

/**
 * Pauses the thread for the specified number of milliseconds.
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> =>
    // tslint:disable-next-line: no-string-based-set-timeout
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export const CRASH = (error?: any) => {
    if (error) {
        console.error(error);
    }
    process.exit(1);
};

export const time = () => new Date().getTime() / 1000;

export const DEFAULT_REQUEST_TIMEOUT = 60 * SECONDS;

export const naturalDiff = (after: Moment, before: Moment) =>
    moment.duration(after.diff(before)).humanize();
