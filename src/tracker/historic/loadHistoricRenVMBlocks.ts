import { RenVMProgress } from "../../database/models";
import { RenNetwork } from "../../networks";
import { List } from "immutable";
import { BlockHandlerInterface, RenVMBlock } from "../blockWatcher/events";
import { fetchBlockTransactions } from "../blockWatcher/blockWatcher";
import { RenVMProvider } from "@renproject/rpc/build/main/v2";
import { SECONDS, sleep } from "../../common/utils";

export const INPUT_FILES = {
    [RenNetwork.Mainnet]: "src/tracker/historic/events/mainnet-chains.json",
    [RenNetwork.Testnet]: "src/tracker/historic/events/testnet-chains.json",
};

export const loadHistoricRenVMBlocks = async (
    network: RenNetwork,
    blocks: List<RenVMBlock>,
    blockHandlers: BlockHandlerInterface[]
) => {
    const client = new RenVMProvider(network);

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
