import { Connection } from "typeorm";
import {
    RenVMInstance,
    RenVMInstances,
} from "../database/models/RenVMInstance";
import { SECONDS, sleep } from "../utils";

export class IndexerClass<Client> {
    client: Client | null;
    instance: RenVMInstances;
    connection: Connection;

    name: string = "";

    constructor(instance: RenVMInstances, connection: Connection) {
        this.client = null;
        this.instance = instance;
        this.connection = connection;
    }

    async connect() {
        if (!this.client) {
            throw new Error("not implemented");
        }
        return this.client;
    }

    async readDatabase() {
        return await RenVMInstance.findOneOrFail({
            name: this.instance,
        });
    }

    async start() {
        const client = await this.connect();

        while (true) {
            try {
                await this.loop(client);
            } catch (error) {
                console.error(error);
            }

            await sleep(10 * SECONDS);
        }
    }

    async loop(client: Client) {}
}
