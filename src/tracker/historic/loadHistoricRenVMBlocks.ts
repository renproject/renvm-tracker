import { RenVMProgress } from "../../database/models";
import { RenNetwork } from "../../networks";
import { List } from "immutable";
import { BlockHandlerInterface, RenVMBlock } from "../blockWatcher/events";
import { fetchBlockTransactions } from "../blockWatcher/blockWatcher";
import { RenVMProvider } from "@renproject/rpc/build/main/v2";
import { SECONDS, sleep } from "../../common/utils";
import { networkConfigs } from "./config";

export const loadHistoricRenVMBlocks = async (
    network: RenNetwork,
    blocks: List<RenVMBlock>,
    blockHandlers: BlockHandlerInterface[]
) => {
    const client = new RenVMProvider(network);

    const networkConfig = networkConfigs[network];

    if (!networkConfig.historicRenVMBlocks) {
        return;
    }

    const renvmState = await RenVMProgress.findOneOrFail();

    for (let i = 0; i < blocks.size; i++) {
        console.log(
            `Processing block ${i}/${blocks.size} (${Math.floor(
                (i / blocks.size) * 100
            )}%)`
        );

        while (true) {
            try {
                const block = await fetchBlockTransactions(
                    client,
                    blocks.get(i)!
                );

                if (
                    block.timestamp.unix() <
                        networkConfig.historicRenVMBlocks.fromTimestamp ||
                    block.timestamp.unix() >
                        networkConfig.historicRenVMBlocks.toTimestamp
                ) {
                    continue;
                }

                for (const blockSubscription of blockHandlers) {
                    await blockSubscription(renvmState, block, undefined);
                }
                break;
            } catch (error) {
                console.error(error);
                console.log("Sleeping for 10 seconds.");
                await sleep(10 * SECONDS);
            }
            console.log("Retrying...");
        }
    }

    await renvmState.save();
};
