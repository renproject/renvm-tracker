const Web3 = require("web3");
const { List } = require("immutable");
const BigNumber = require("bignumber.js");
const fs = require("fs");

const skip = 1000000;

const INFURA_KEY = "51d73bc74964423aab6c3f0ed0565b76";

const mainnet = {
    chain: "Ethereum",
    from: 9737055,
    to: 11676149,
    network: "mainnet",
    gateways: [
        ["BTC", "0xe4b679400F0f267212D5D812B95f58C83243EE71"],
        ["ZEC", "0xc3BbD5aDb611dd74eCa6123F05B18acc886e122D"],
        ["BCH", "0xCc4FF5b8A4A7adb35F00ff0CBf53784e07c3C52F"],
    ],
    infuraURL: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

const mainnetVDot3 = {
    chain: "Ethereum",
    from: 11156227,
    to: 11676149,
    network: "mainnet-v0.3",
    gateways: [
        ["FIL", "0xED7D080AA1d2A4D468C615a5d481125Bb56BF1bf"],
        ["DGB", "0x05387a10Bb3EF789b6C2a9CE2d6C21D5a8c6B1aA"],
        ["DOGE", "0x2362843745615368F4ef0A43D7502353649C0783"],
        ["LUNA", "0xD7D7Deab930B6d3f98b35A26a4c431630d5AB874"],
    ],
    infuraURL: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

const testnet = {
    chain: "Ethereum",
    from: 17626072,
    to: 23054235,
    network: "testnet",
    gateways: [
        ["BTC", "0x55363c0dBf97Ff9C0e31dAfe0fC99d3e9ce50b8A"],
        ["ZEC", "0xAACbB1e7bA99F2Ed6bd02eC96C2F9a52013Efe2d"],
        ["BCH", "0x9827c8a66a2259fd926E7Fd92EA8DF7ed1D813b1"],
    ],
    infuraURL: `https://kovan.infura.io/v3/${INFURA_KEY}`,
};

const testnetVDot3 = {
    chain: "Ethereum",
    from: 7434458,
    to: 7913592,
    network: "testnet-v0.3",
    gateways: [
        ["BTC", "0x1E1A6B5288a6c804aDE4E597Ed8df7064A1d961A"],
        ["ZEC", "0x0b001a3a329F868dc4EcD5089f027ac6f4108240"],
        ["BCH", "0xb6eC7Ca09F23612894f8D681cE2Ff8c07BA45D40"],
        ["DGB", "0x17D013fBf38187D97B64512E4999e8F062A7d777"],
        ["DOGE", "0xe6233D686eF2B346e98031af8b9e55831C57D74C"],
        ["BNB", "0x39c268e728Fce3fDc75534c7641FdE2024445B49"],
        ["FIL", "0xaD38ED4AF98b2159cD8A399FAeF863690510b8B5"],
        ["LUNA", "0x8f5d51E75131838A463be28c0D4E24c578eA289f"],
    ],
    infuraURL: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
};

const bscTestnet = {
    chain: "BinanceSmartChain",
    from: 3104702,
    to: 5488028,
    network: "testnet-v0.3",
    gateways: [
        ["BTC", "0x6003FD1C2d4eeDed7cb5E89923AB457d1DE5cE89"],
        ["DOGE", "0x7517FadFA7247ffe52d57c78780FfF0662a09936"],
        ["ETH", "0x18E12421fdD63220e2A0A34497724431b1a829f4"],
        ["ZEC", "0x00E094aff24746196Bf73491A4C276fa4db503b4"],
        ["BCH", "0xBA7236b2fbe3F12Df15a0d5fcE57d891016822f8"],
        ["DGB", "0xd5E7d585D471BaFF2060dAFeaf701ff89114e439"],
        ["FIL", "0x36C0B3C9531B558055c8237E730e4f618d238Cb7"],
        ["LUNA", "0x26f4F36A070190Ee4379241DD1463A420768EB4B"],
    ],
    infuraURL: "https://data-seed-prebsc-1-s1.binance.org:8545",
};

const bscMainnet = {
    chain: "BinanceSmartChain",
    from: 2132424,
    to: 4084072,
    network: "mainnet-v0.3",
    gateways: [
        ["BTC", "0x95De7b32e24B62c44A4C44521eFF4493f1d1fE13"],
        ["ZEC", "0xfdecB67cE94A22C8e227D17938c3127EA1B47B4E"],
        ["BCH", "0x3023DD075B0291Cd6aDc890A1EBDD6C400595E08"],
        ["FIL", "0x05Cadbf3128BcB7f2b89F3dD55E5B0a036a49e20"],
        ["DGB", "0x7986568375Af35B427f3f51389d73196967C356a"],
        ["DOGE", "0x06A2C5d79c66268610eEBBca10AFa17092860830"],
        ["LUNA", "0x4d59f628CB8e4670b779eAE22aF0c46DebC06695"],
    ],
    infuraURL: "https://bsc-dataseed.binance.org/",
};

const main = async () => {
    let fileString = "[\n";

    let eventArray = List();

    for (const networkDetails of [
        mainnet,
        mainnetVDot3,
        testnet,
        testnetVDot3,
        bscTestnet,
        bscMainnet,
    ]) {
        const {
            chain,
            from,
            to,
            network,
            gateways,
            infuraURL,
        } = networkDetails;

        const web3 = new Web3(infuraURL);

        const toTimestamp = (await web3.eth.getBlock(to)).timestamp;
        const fromTimestamp = (await web3.eth.getBlock(from)).timestamp;
        const blockTime = (toTimestamp - fromTimestamp) / (to - from);

        console.error(`Estimating block time as ${blockTime}s.`);

        let count = 0;

        let total = new BigNumber(0);

        for (let i = from; i < to; i += skip) {
            let trades = List();

            for (const [symbol, gateway] of gateways) {
                console.error(symbol, i, Math.min(i + skip, to));
                const logs = await web3.eth.getPastLogs({
                    address: gateway,
                    fromBlock: i,
                    toBlock: Math.min(i + skip, to),
                    topics: [
                        web3.utils.keccak256(
                            "LogMint(address,uint256,uint256,bytes32)"
                        ),
                    ],
                });

                for (const log of logs) {
                    const trade = {
                        network,
                        chain,
                        symbol,
                        timestamp: Math.floor(
                            toTimestamp - (to - log.blockNumber) * blockTime
                        ),
                        amount: new BigNumber(log.data).toFixed(),
                    };

                    trades = trades.push(trade);
                }

                const burnLogs = await web3.eth.getPastLogs({
                    address: gateway,
                    fromBlock: i,
                    toBlock: Math.min(i + skip, to),
                    topics: [
                        web3.utils.keccak256(
                            "LogBurn(bytes,uint256,uint256,bytes)"
                        ),
                    ],
                });

                for (const log of burnLogs) {
                    const trade = {
                        network,
                        chain,
                        symbol,
                        timestamp: Math.floor(
                            toTimestamp - (to - log.blockNumber) * blockTime
                        ),
                        amount: new BigNumber(
                            "0x" + log.data.slice(64 + 2, 128 + 2)
                        )
                            .negated()
                            .toFixed(),
                    };

                    trades = trades.push(trade);

                    total = total.plus(trade.amount);
                }
            }

            trades = trades.sort((trade) => trade.timestamp);

            for (const trade of trades) {
                eventArray = eventArray.push(trade);
                fileString += "  " + JSON.stringify(trade) + "," + "\n";
                count++;
            }
        }

        console.error(
            `Processed ${count} trades. Sum: ${total.dividedBy(
                new BigNumber(10).exponentiatedBy(8)
            )}`
        );
    }

    console.error(`Writing to file...`);

    eventArray = eventArray.sortBy(x => x.timestamp);
        
    for (const trade of list) {
        fileString = fileString + "  " + JSON.stringify(trade) + ",\n";
    }
    
    fileString = fileString.replace(/,\n$/, "\n]");

    // write file to disk
    fs.writeFile("./out.json", fileString, "utf8", (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`File is written successfully!`);
        }
    });
};

main().catch(console.error);

// 49743
