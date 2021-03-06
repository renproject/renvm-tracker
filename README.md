# `RenVM Tracker`

The RenVM Tracker is a server that syncs RenVM blocks and tracks volume, locked amounts and historic asset prices. It provides a GraphQL endpoint to query RenVM stats for a provided timestamp, available at [stats.renproject.io](https://stats.renproject.io).

## ~ [Documentation](https://renproject.github.io/ren-client-docs/stats/renvm-stats) ~

The documentation includes a GraphQL sandbox to test queries in the browser.

<hr />

<details>

<summary>Maintainer notes</summary>

<br />

## Maintainer notes

### TODO

Stats to add:

-   Historic fee stats
-   Darknode stats

### Notes

In order to keep a 1:1 map between the database entities and the GraphQL schema,
the volumes, locked amounts and prices are manipulated as strings. Any Snapshot
manipulation should be confined to `snapshotUtils`.

### Current set-up guides:

1. Run a ren_queryBlock and note the height and timestamp.
2. At the top of historic.ts, update the timestamp.
3. In historic.ts, select the relevant chains at the top of `main`.
4. Run historic.ts (`yarn run:generate-historic`) and commit the changes to `final.json`.
5. Switch off the heroku server.
6. Reset the database.
7. Push to heroku.
8. Restart the heroku server.

</details>
