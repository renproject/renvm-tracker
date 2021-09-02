import { List } from "immutable";
import { Connection } from "typeorm";

import { CRASH } from "../common/utils";
import { BlockHandler } from "./blockHandler/blockHandler";
import { loadHistoricEVMEvents } from "./historic/loadHistoricEVMEvents";
import { BlockWatcher } from "./blockWatcher/blockWatcher";
import { RenNetwork } from "../networks";
import { networkConfigs } from "./historic/config";
import { loadHistoricRenVMBlocks } from "./historic/loadHistoricRenVMBlocks";
import { RenVMProgress } from "../database/models";

export const runTracker = async (
    network: RenNetwork.Mainnet | RenNetwork.Testnet,
    connection: Connection,
    initialize: boolean
) => {
    const blockHandler = new BlockHandler(network, connection);

    const renVM = await RenVMProgress.findOneOrFail();

    // Checks if it needs to load the historic events into the database.
    if (initialize) {
        const { historicChainEvents, historicRenVMBlocks, liveRenVM } =
            networkConfigs[network];

        console.log("historicChainEvents", historicChainEvents);
        console.log("historicRenVMBlocks", historicRenVMBlocks);

        if (historicChainEvents) {
            console.log(`Loading historic EVM events...`);
            const eventArray = await historicChainEvents.events();
            const eventList = List(eventArray).sortBy(
                (event) => event.timestamp
            );

            await loadHistoricEVMEvents(network, eventList);

            console.log(`Done loading historic EVM events.`);
        }

        if (historicRenVMBlocks) {
            console.log(`Loading historic RenVM blocks...`);
            for (const blockFetcher of historicRenVMBlocks.blocks) {
                const blockArray = await blockFetcher();
                const blockList = List(blockArray);

                await loadHistoricRenVMBlocks(network, blockList, [
                    blockHandler.blockHandler,
                ]);
            }

            renVM.migrationCount = renVM.migrationCount + 1;
            renVM.syncedBlock = liveRenVM.fromBlock - 1;

            console.log(`Done loading historic RenVM blocks.`);
        }
    }

    // Mark initialization as being done.
    renVM.initialized = true;
    await renVM.save();

    // Start the block watcher and subscribe the block handler to block events.
    const blockWatcher = new BlockWatcher(network, connection);
    blockWatcher.subscribe("block", blockHandler.blockHandler);
    blockWatcher.start().catch(CRASH);
};
