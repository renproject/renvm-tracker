# `account-chain-indexer`

Minimal server that matches transactions to specific addresses.



Current set-up guides:

1. Run a ren_queryBlock and note the height and timestamp.
2. At the top of historic.ts, update the timestamp.
3. In historic.ts, select the relevant chains at the top of `main`.
4. Run historic.ts (`yarn historic`) and commit the changes to `final.json`.
5. Switch off the heroku server.
6. Reset the database.
7. Push to heroku.
8. Restart the heroku server.
