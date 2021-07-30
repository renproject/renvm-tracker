# `RenVM Tracker`

The RenVM Tracker is a server that syncs RenVM blocks and tracks volume, locked
amounts and historic asset prices.

# Usage

The interface is a GraphQL endpoint running at https://renvm-tracker.herokuapp.com.

There is one type of queryable entities, `Snapshots`, which contain RenVM's statistics for a specific timestamp.

The volume in a `Snapshot` is the total since the network came online, so to get the volume of a specific period (e.g. 1 month), you should get the snapshots from the start and the end of the period and subtract the volume and locked amounts.

You can request multiple snapshots in a single request by using labels (see the label `snapshot1` below).

```
{
  snapshot1: Snapshot(timestamp: "1627300267") {
    id
    timestamp
    locked {
      asset
      chain
      amount
      amountInUsd
    }
    volume {
      asset
      chain
      amount
      amountInUsd
    }
    prices {
      asset
      decimals
      priceInUsd
    }
  }
}
```

You will need a GraphQL client - you can find a list for various languages at https://graphql.org/code/. The Ren front-ends use the [Apollo Client](https://www.npmjs.com/package/@apollo/client).

<details>

<summary>Developer notes</summary>

<br />

# Developer notes

### TODO

-   Add fee and darknode infromation
-   Testnet version

### Notes

In order to keep a 1:1 map between the database entities and the GraphQL schema,
the volumes, locked amounts and prices are manipulated as strings. Any Snapshot
manipulation should be confined to `snapshotUtils`.

### Current set-up guides:

1. Run a ren_queryBlock and note the height and timestamp.
2. At the top of historic.ts, update the timestamp.
3. In historic.ts, select the relevant chains at the top of `main`.
4. Run historic.ts (`yarn generate-historic`) and commit the changes to `final.json`.
5. Switch off the heroku server.
6. Reset the database.
7. Push to heroku.
8. Restart the heroku server.

</details>
