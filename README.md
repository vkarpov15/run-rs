# run-rs

Zero-config MongoDB runner. Starts a replica set with no non-Node dependencies, not even MongoDB.

<img src="https://raw.githubusercontent.com/vkarpov15/run-rs/master/images/logo.png">

## Usage

To install:

```
npm install run-rs -g
```

With run-rs, starting a 3 node [replica set](https://docs.mongodb.com/manual/tutorial/deploy-replica-set/) running MongoDB 3.6 is a one-liner.

```
run-rs
```

To use a different version, use the `-v` flag. For example, this will start a 3 node replica set using MongoDB 4.0.0.

```
run-rs -v 4.0.0
```

On linux, for 4.2.0 version, by default download `ubuntu1604`, change with command

```
run-rs -l ubuntu1804
```

## Clearing the Database

Run-rs clears the database every time it starts by default. To override this behavior, use the `--keep` (`-k`) flag.

```
run-rs --keep
```

## OS Support

Run-rs supports Linux, OSX, and Windows 10 (via [git bash](https://git-scm.com/downloads) or powershell).

## Shell Option

Use the `--shell` flag to start a MongoDB shell connected to your replica
set once the replica set is running.

```
$ run-rs --shell
Purging database...
Running '/home/node/lib/node_modules/run-rs/3.6.5/mongod'
Starting replica set...
Started replica set on "mongodb://localhost:27017,localhost:27018,localhost:27019"
Connecting shell /home/node/lib/node_modules/run-rs/3.6.5/mongo
rs:PRIMARY>
```

## Notes on Connecting

Use `replicaSet=rs` in your connection string.

**For Windows Users:** Do NOT use `localhost` or `127.0.0.1` for the host name in your connection string, use *computer name* instead. See example connection string below:

```
mongodb://sk-zm-los-bdb:27017,sk-zm-los-bdb:27018,sk-zm-los-bdb:27019/dbname?replicaSet=rs
```
*where* `sk-zm-los-bdb` is the *hostname* or the *name of your computer*, `dbname` is the name of your *database*, and *rs* is the name of your replica set.

## Reusing a Pre-installed MongoDB Version

By default, run-rs will download whatever version of MongoDB you've specified. If you already have MongoDB installed, you can use the `--mongod` option:

```
run-rs --mongod
```

The above command will just run whatever `mongod` is on your PATH. If you want to run a specific `mongod` server, you can do this:

```
run-rs --mongod /home/user/path/to/mongod
```

## Specify the data directory

By default, run-rs will store data files in a directory named 'data'. To specify a dbPath for run-rs to use as a data directory, use the `--dbpath` option.

```
run-rs --dbpath /path/to/data/directory
```

## IP Binding

Use the `--host` option to ensure that `run-rs` allows MongoDB to listen for connections on configured IP addresses or hostnames other than `localhost` and `127.0.0.1`. See examples below:

```
run-rs --host 198.51.100.1
````
**OR**
```
run-rs --host example-associated-hostname
```
**Note:** *Before you bind to other ip addresses, consider [enabling access control](https://docs.mongodb.com/manual/administration/security-checklist/#checklist-auth) and other security measures listed in [Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/) to prevent unauthorized access.*

## Ports

By default, run-rs will start MongoDB servers on ports 27017, 27018, and 27019.
You can override this default using the `--portStart` option.
For example, the below command will start MongoDB servers on ports 27000, 27001, and 27002.

```
run-rs --portStart 27000
```

## Running in Production

Do **not** use run-rs for running your production database. Run-rs is designed
for local development and testing, and is not intended for production use.
If you want to run MongoDB in production and don't want to manage a replica
set yourself, use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
