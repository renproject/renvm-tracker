import Web3 from "web3";
import { List } from "immutable";
import BigNumber from "bignumber.js";
import { writeFile } from "fs";

const skip = 250000;

const INFURA_KEY = "51d73bc74964423aab6c3f0ed0565b76";

const mainnet = {
    chain: "Ethereum",
    from: 9737055,
    to: 11676149,
    network: "mainnet",
    gateways: [
        [
            "BTC",
            "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D",
            "0xe4b679400F0f267212D5D812B95f58C83243EE71",
        ],
        [
            "ZEC",
            "0x1C5db575E2Ff833E46a2E9864C22F4B22E0B37C2",
            "0xc3BbD5aDb611dd74eCa6123F05B18acc886e122D",
        ],
        [
            "BCH",
            "0x459086F2376525BdCebA5bDDA135e4E9d3FeF5bf",
            "0xCc4FF5b8A4A7adb35F00ff0CBf53784e07c3C52F",
        ],
    ],
    infuraURL: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

const mainnetVDot3 = {
    chain: "Ethereum",
    from: 11156227,
    to: 11676149,
    network: "mainnet-v0.3",
    gateways: [
        [
            "FIL",
            "0xD5147bc8e386d91Cc5DBE72099DAC6C9b99276F5",
            "0xED7D080AA1d2A4D468C615a5d481125Bb56BF1bf",
        ],
        [
            "DGB",
            "0xe3Cb486f3f5C639e98cCBaF57d95369375687F80",
            "0x05387a10Bb3EF789b6C2a9CE2d6C21D5a8c6B1aA",
        ],
        [
            "DOGE",
            "0x3832d2F059E55934220881F831bE501D180671A7",
            "0x2362843745615368F4ef0A43D7502353649C0783",
        ],
        [
            "LUNA",
            "0x52d87F22192131636F93c5AB18d0127Ea52CB641",
            "0xD7D7Deab930B6d3f98b35A26a4c431630d5AB874",
        ],
    ],
    infuraURL: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
};

const testnet = {
    chain: "Ethereum",
    from: 17626072,
    to: 23054235,
    network: "testnet",
    gateways: [
        [
            "BTC",
            "0x0A9ADD98C076448CBcFAcf5E457DA12ddbEF4A8f",
            "0x55363c0dBf97Ff9C0e31dAfe0fC99d3e9ce50b8A",
        ],
        [
            "ZEC",
            "0x42805DA220DF1f8a33C16B0DF9CE876B9d416610",
            "0xAACbB1e7bA99F2Ed6bd02eC96C2F9a52013Efe2d",
        ],
        [
            "BCH",
            "0x618dC53e856b1A601119F2Fed5F1E873bCf7Bd6e",
            "0x9827c8a66a2259fd926E7Fd92EA8DF7ed1D813b1",
        ],
    ],
    infuraURL: `https://kovan.infura.io/v3/${INFURA_KEY}`,
};

const testnetVDot3 = {
    chain: "Ethereum",
    from: 7434458,
    to: 7913592,
    network: "testnet-v0.3",
    gateways: [
        [
            "BTC",
            "0x48d7442B9BB36FEe26a81E1b634D1c4f75BAe4Ad",
            "0x1E1A6B5288a6c804aDE4E597Ed8df7064A1d961A",
        ],
        [
            "ZEC",
            "0xB0b458DeEa6DC99E683B63dAc3a6Ee5Fc1B6f493",
            "0x0b001a3a329F868dc4EcD5089f027ac6f4108240",
        ],
        [
            "BCH",
            "0xDD35d74c8EF6981Eb8b01F8F74358Cf667B20Abe",
            "0xb6eC7Ca09F23612894f8D681cE2Ff8c07BA45D40",
        ],
        [
            "DGB",
            "0xA6ABf9562874fec05aEDDd9426757af9d89cEE89",
            "0x17D013fBf38187D97B64512E4999e8F062A7d777",
        ],
        [
            "DOGE",
            "0x40fC71314361CAE71Ce340851D37553FE478B9A3",
            "0xe6233D686eF2B346e98031af8b9e55831C57D74C",
        ],
        [
            "BNB",
            "0x12640903Fc6aD421e610259e93280edB123FB54d",
            "0x39c268e728Fce3fDc75534c7641FdE2024445B49",
        ],
        [
            "FIL",
            "0x5fF7E913Cd7504F965c16daBA7e335e0e3Ee5409",
            "0xaD38ED4AF98b2159cD8A399FAeF863690510b8B5",
        ],
        [
            "LUNA",
            "0x77F710CCc6190b398792dCcC1755c514a3B18E56",
            "0x8f5d51E75131838A463be28c0D4E24c578eA289f",
        ],
    ],
    infuraURL: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
};

const bscTestnet = {
    chain: "BinanceSmartChain",
    from: 3104702,
    to: 5488028,
    network: "testnet-v0.3",
    gateways: [
        [
            "BTC",
            "0x5eB4F537889eC3C7Ec397F1acB33c70D8C0ee438",
            "0x6003FD1C2d4eeDed7cb5E89923AB457d1DE5cE89",
        ],
        [
            "DOGE",
            "0xAF787a25241c69ae213A8Ee08a2518D858b32dBd",
            "0x7517FadFA7247ffe52d57c78780FfF0662a09936",
        ],
        [
            "ETH",
            "0xdE0316Db06e3AA5F3291850694543aEA928E72Ca",
            "0x18E12421fdD63220e2A0A34497724431b1a829f4",
        ],
        [
            "ZEC",
            "0xD566bB681a231f5648D7cB0f09A89cb47fd09513",
            "0x00E094aff24746196Bf73491A4C276fa4db503b4",
        ],
        [
            "BCH",
            "0xE980BC9e17094EB273c6b5A1139b3A30EcdF05e0",
            "0xBA7236b2fbe3F12Df15a0d5fcE57d891016822f8",
        ],
        [
            "DGB",
            "0x8C0248Ab26FcD6868Cc5aaea954f0ce28F8E103f",
            "0xd5E7d585D471BaFF2060dAFeaf701ff89114e439",
        ],
        [
            "FIL",
            "0xD43DaA686Ea5b20fACaD7945a0eA1187f412958f",
            "0x36C0B3C9531B558055c8237E730e4f618d238Cb7",
        ],
        [
            "LUNA",
            "0x2c82a39549858A0fF1a369D84695D983791d0786",
            "0x26f4F36A070190Ee4379241DD1463A420768EB4B",
        ],
    ],
    infuraURL: "https://data-seed-prebsc-1-s1.binance.org:8545",
};

const bscMainnet = {
    chain: "BinanceSmartChain",
    from: 2132424,
    to: 4084072,
    network: "mainnet-v0.3",
    gateways: [
        [
            "BTC",
            "0xfCe146bF3146100cfe5dB4129cf6C82b0eF4Ad8c",
            "0x95De7b32e24B62c44A4C44521eFF4493f1d1fE13",
        ],
        [
            "ZEC",
            "0x695FD30aF473F2960e81Dc9bA7cB67679d35EDb7",
            "0xfdecB67cE94A22C8e227D17938c3127EA1B47B4E",
        ],
        [
            "BCH",
            "0xA164B067193bd119933e5C1e7877421FCE53D3E5",
            "0x3023DD075B0291Cd6aDc890A1EBDD6C400595E08",
        ],
        [
            "FIL",
            "0xDBf31dF14B66535aF65AaC99C32e9eA844e14501",
            "0x05Cadbf3128BcB7f2b89F3dD55E5B0a036a49e20",
        ],
        [
            "DGB",
            "0x31a0D1A199631D244761EEba67e8501296d2E383",
            "0x7986568375Af35B427f3f51389d73196967C356a",
        ],
        [
            "DOGE",
            "0xc3fEd6eB39178A541D274e6Fc748d48f0Ca01CC3",
            "0x06A2C5d79c66268610eEBBca10AFa17092860830",
        ],
        [
            "LUNA",
            "0xc4Ace9278e7E01755B670C0838c3106367639962",
            "0x4d59f628CB8e4670b779eAE22aF0c46DebC06695",
        ],
    ],
    infuraURL: "https://bsc-dataseed.binance.org/",
};

const getLogs = async (web3: Web3, params) => {
    while (true) {
        try {
            return await web3.eth.getPastLogs(params);
        } catch (error) {
            console.error(error);
        }
    }
};

const main = async () => {
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

        const toTimestamp = new BigNumber(
            (await web3.eth.getBlock(to)).timestamp
        ).toNumber();
        const fromTimestamp = new BigNumber(
            (await web3.eth.getBlock(from)).timestamp
        ).toNumber();
        const blockTime = (toTimestamp - fromTimestamp) / (to - from);

        console.error(`Estimating block time as ${blockTime}s.`);

        let count = 0;

        let total = new BigNumber(0);

        for (let i = from; i < to; i += skip) {
            let trades = List();

            for (const [symbol, gateway] of gateways) {
                console.error(symbol, i, Math.min(i + skip, to));
                const mintLogs = await getLogs(web3, {
                    address: gateway,
                    fromBlock: i,
                    toBlock: Math.min(i + skip, to),
                    topics: [
                        web3.utils.keccak256(
                            "Transfer(address,address,uint256)"
                        ),
                        "0x0000000000000000000000000000000000000000000000000000000000000000",
                    ],
                });

                console.log("mintLogs", mintLogs.length);

                for (const log of mintLogs) {
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

                    if (symbol === "BTC") {
                        total = total.plus(trade.amount);
                        // console.log(
                        //     `total: ${total
                        //         .dividedBy(new BigNumber(10).exponentiatedBy(8))
                        //         .toFixed()}`
                        // );
                    }
                    // if (symbol === "BTC" && log.blockNumber > 11676149) {
                    //     console.log(
                    //         `Mint: ${new BigNumber(trade.amount)
                    //             .dividedBy(new BigNumber(10).exponentiatedBy(8))
                    //             .toFixed()} BTC`
                    //     );
                    // }
                }

                const burnLogs = await getLogs(web3, {
                    address: gateway,
                    fromBlock: i,
                    toBlock: Math.min(i + skip, to),
                    topics: [
                        // web3.utils.keccak256(
                        //     "LogBurn(bytes,uint256,uint256,bytes)"
                        // ),
                        web3.utils.keccak256(
                            "Transfer(address,address,uint256)"
                        ),
                        null,
                        "0x0000000000000000000000000000000000000000000000000000000000000000",
                    ],
                });

                console.log("burnLogs", burnLogs.length);

                for (const log of burnLogs) {
                    const burn = {
                        network,
                        chain,
                        symbol,
                        timestamp: Math.floor(
                            toTimestamp - (to - log.blockNumber) * blockTime
                        ),
                        amount: new BigNumber(
                            // "0x" + log.data.slice(64 + 2, 128 + 2)
                            log.data
                        )
                            .negated()
                            .toFixed(),
                    };

                    trades = trades.push(burn);

                    if (symbol === "BTC") {
                        total = total.plus(burn.amount);
                        // console.log(
                        //     `total: ${total
                        //         .dividedBy(new BigNumber(10).exponentiatedBy(8))
                        //         .toFixed()}`
                        // );
                    }

                    // if (symbol === "BTC" && log.blockNumber > 11676149) {
                    //     console.log(
                    //         `Burn: ${new BigNumber(burn.amount)
                    //             .dividedBy(new BigNumber(10).exponentiatedBy(8))
                    //             .toFixed()} BTC`
                    //     );
                    // }
                }
            }

            trades = trades.sort((trade) => trade.timestamp);

            eventArray = eventArray.merge(trades);
            count += trades.size;
        }

        console.error(
            `Processed ${count} trades. Sum: ${total.dividedBy(
                new BigNumber(10).exponentiatedBy(8)
            )}`
        );
    }

    console.error(`Writing to file...`);

    eventArray = eventArray.sortBy((x) => x.timestamp);

    console.log(eventArray.size);
    const fileString = JSON.stringify(eventArray.toJSON());

    // write file to disk
    writeFile("./out.json", fileString, "utf8", (err) => {
        if (err) {
            console.log(`Error writing file: ${err}`);
        } else {
            console.log(`File is written successfully!`);
        }
    });
};

main().catch(console.error);

// 49743

// 118844.90071549 - 50112 events
