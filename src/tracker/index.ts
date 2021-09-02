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

    // Checks if it needs to load the historic events into the database.
    if (initialize) {
        const { historicChainEvents, historicRenVMBlocks } =
            networkConfigs[network];

        console.log("historicChainEvents", historicChainEvents);
        console.log("historicRenVMBlocks", historicRenVMBlocks);

        // if (historicChainEvents) {
        //     console.log(`Loading historic RenVM blocks...`);
        //     const eventArray = await historicChainEvents.events();
        //     const eventList = List(eventArray).sortBy(
        //         (event) => event.timestamp
        //     );

        //     await loadHistoricEVMEvents(eventList);

        //     console.log(`Done loading historic EVM blocks.`);
        // }

        if (historicRenVMBlocks) {
            console.log(`Loading historic RenVM blocks...`);
            const blockArray = await historicRenVMBlocks.blocks();
            const blockList = List(blockArray);

            await loadHistoricRenVMBlocks(network, blockList, [
                blockHandler.blockHandler,
            ]);
            console.log(`Done loading historic RenVM blocks.`);
        }
    }

    // Mark initialization as being done.
    const renVM = await RenVMProgress.findOneOrFail();
    renVM.initialized = true;
    await renVM.save();

    // Start the block watcher and subscribe the block handler to block events.
    const blockWatcher = new BlockWatcher(network, connection);
    blockWatcher.subscribe("block", blockHandler.blockHandler);
    blockWatcher.start().catch(CRASH);
};
