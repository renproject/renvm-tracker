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

export const CRASH = () => {
    process.exit(1);
};

export const RESET = "\x1b[0m";

export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
