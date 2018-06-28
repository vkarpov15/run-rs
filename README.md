# run-rs

Zero-config MongoDB runner. Starts a replica set with no non-Node dependencies, not even MongoDB.

## Usage

To install:

```
npm install run-rs -g
```

With run-rs, starting a 3 node [replica set](https://docs.mongodb.com/manual/tutorial/deploy-replica-set/) running MongoDB 3.6 is a one-liner.

```
run-rs
```

To use a different version, use the `-v` flag. For example, this will start a 3 node replica set using MongoDB 4.0.0-rc2.

```
run-rs -v 4.0.0-rc2
```

## Clearing the Database

Run-rs clears the database every time it starts by default. To override this behavior, use the `--keep` (`-k`) flag.

```
run-rs --keep
```
