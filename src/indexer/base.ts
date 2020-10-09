import { Chain } from "../database/models/Chain";
import { SECONDS, sleep } from "../utils";

export interface IndexerInterface {
    getLatestHeight(): Promise<number>;
}

export class IndexerClass<Client, Network extends string = string>
    implements IndexerInterface {
    client: Client | null;
    network: Network;

    name: string = "";

    constructor(network: Network) {
        this.client = null;
        this.network = network;
    }

    async connect() {
        if (!this.client) {
            throw new Error("not implemented");
        }
        return this.client;
    }

    async readDatabase() {
        return await Chain.findOneOrFail({
            name: this.name,
            network: this.network,
        });
    }

    async start() {
        const client = await this.connect();

        while (true) {
            // Filecoin Testnet ////////////////////////////////////////////////////

            try {
                await this.loop(client);
            } catch (error) {
                console.error(error);
            }

            await sleep(10 * SECONDS);
        }
    }

    async loop(client: Client) {}

    async getLatestHeight(): Promise<number> {
        throw new Error("not implemented");
    }
}
