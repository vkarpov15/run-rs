#!/usr/bin/env node

'use strict';

const ReplSet = require('mongodb-topology-manager').ReplSet;
const chalk = require('chalk');
const co = require('co');
const commander = require('commander');
const dl = require('./dl');
const execSync = require('child_process').execSync;
const fs = require('fs');
const moment = require('moment');
const mongodb = require('mongodb');
const prettyjson = require('prettyjson');
const spawn = require('child_process').spawn;

let ports = [];
const isWin = process.platform === 'win32';

commander.
  option('-v, --version [version]', 'Version to use').
  option('-k, --keep', 'Use this flag to skip clearing the database on startup').
  option('-s, --shell', 'Use this flag to automatically open up a MongoDB shell when the replica set is started').
  option('-q, --quiet', 'Use this flag to suppress any output after starting').
  option('-m, --mongod', 'Skip downloading MongoDB and use this executable. If blank, just uses `mongod`. For instance, `run-rs --mongod` is equivalent to `run-rs --mongod mongod`').
  option('-n, --number [num]', 'Number of mongods in the replica set. 3 by default.').
  option('-p, --portStart [num]', 'Start binding mongods contiguously from this port. The default is 27017').
  parse(process.argv);

co(run).catch(error => console.error(error.stack));

function* run() {
  const options = {};
  const rcfile = `${process.cwd()}/.run-rs.rc`;
  if (fs.existsSync(rcfile)) {
    Object.assign(options, JSON.parse(fs.readFileSync(rcfile, 'utf8')));
  }
  const version = typeof commander.version === 'string' ?
    commander.version :
    options.version || '3.6.6';

  const n = parseInt(commander.number, 10) || 3;
  const startingPort = parseInt(commander.portStart, 10) || 27017;

  for (let i = 0; i < n; ++i) {
    ports.push(startingPort + i);
  }

  let mongod;
  let mongo;
  if (commander.mongod) {
    mongod = typeof commander.mongod === 'string' ? commander.mongod : 'mongod';
    mongo = typeof commander.mongod === 'string' ?
      commander.mongod.replace(/mongod$/i, 'mongo') :
      'mongo';
  } else {
    mongod = `${__dirname}/${version}/mongod${isWin ? '.exe' : ''}`;
    mongo = `${__dirname}/${version}/mongo${isWin ? '.exe' : ''}`;

    if (!fs.existsSync(mongod)) {
      dl(version);
    }
  }

  if (!fs.existsSync('./data')) {
    execSync(isWin ? 'md .\\data' : 'mkdir -p ./data');
  }
  if (commander.keep) {
    console.log(chalk.blue('Skipping purge'));
  } else {
    console.log(chalk.blue('Purging database...'));
    execSync(isWin ? 'del /S /Q .\\data\\*' : 'rm -rf ./data/*');
  }

  ports.forEach((port) => {
    if (!fs.existsSync(`./data/${port}`)) {
      execSync(isWin ? `md .\\data\\${port}` : `mkdir -p ./data/${port}`);
    }
  });

  console.log(`Running '${mongod}'`, ports);
  const rs = new ReplSet(mongod,
    ports.map(port => ({
      options: {
        port: port,
        dbpath: `${process.cwd()}/data/${port}`,
        bind_ip: '127.0.0.1'
      }
    })), { replSet: 'rs' });

  if (commander.keep) {
    console.log(chalk.blue('Restarting replica set...'));
    for (const manager of rs.managers) {
      yield manager.start();
    }
    const result = yield rs.managers[0].executeCommand('admin.$cmd', {
      replSetGetStatus: 1
    }, null, { ignoreError: true });

    if (result.set) {
      // There's already a replica set config, so don't initiate
      yield rs.waitForPrimary();
    } else {
      // First time starting up, need to create a replica set config
      for (const manager of rs.managers) {
        yield manager.stop();
      }
      yield rs.start();
    }
  } else {
    console.log(chalk.blue('Starting replica set...'));
    yield rs.start();
  }

  const hosts = ports.map(port => `localhost:${port}`);
  console.log(chalk.green(`Started replica set on "mongodb://${hosts.join(',')}?replicaSet=rs"`));

  if (commander.shell) {
    console.log(chalk.blue(`Running mongo shell: ${mongo}`));
    spawn(mongo, ['--quiet'], { stdio: 'inherit' });
  } else if (!commander.quiet) {
    const client = yield mongodb.MongoClient.connect(`mongodb://${hosts[0]}/test`, {
      useNewUrlParser: true
    });

    const oplog = client.db('local').collection('oplog.rs').find({ ts: { $gte: new mongodb.Timestamp() } }, {
      tailable: true,
      awaitData: true,
      oplogReplay: true,
      noCursorTimeout: true,
      numberOfRetries: Number.MAX_VALUE
    }).stream();

    console.log(chalk.green('Connected to oplog'));

    oplog.on('end', () => {
      console.log(moment().format('YYYY-MM-DD HH:mm:ss'), chalk.red('MongoDB oplog finished'));
    });
    oplog.on('data', data => {
      if (['n'].includes(data.op)) {
        return;
      }
      if (data.ns.startsWith('admin.') || data.ns.startsWith('config.')) {
        return;
      }
      const ops = {
        c: 'createCollection',
        d: 'delete',
        i: 'insert',
        u: 'update'
      };
      const op = ops[data.op] || data.op;

      let o = prettyjson.render(JSON.parse(JSON.stringify(data.o)));
      if ('o2' in data) {
        o = `${prettyjson.render(JSON.parse(JSON.stringify(data.o2)))} ${o}`;
      }
      console.log(chalk.blue(moment().format('YYYY-MM-DD HH:mm:ss')), data.ns, op);
      console.log(o);
    });
    oplog.on('error', err => {
      console.log(chalk.red(moment().format('YYYY-MM-DD HH:mm:ss')), chalk.red(`Oplog error: ${err.stack}`));
    });
  }
}
