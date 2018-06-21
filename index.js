#!/usr/bin/env node

'use strict';

const chalk = require('chalk');
const co = require('co');
const commander = require('commander');
const dl = require('./dl');
const execSync = require('child_process').execSync;
const fs = require('fs');
const moment = require('moment');
const mongodb = require('mongodb');
const ReplSet = require('mongodb-topology-manager').ReplSet;

commander.
  option('-v, --version [version]', 'Version to use').
  option('-k, --keep', 'Use this flag to skip clearing the database on startup').
  parse(process.argv);

const version = commander.v || '3.6.4';

co(run).catch(error => console.error(error.stack));

function* run() {
  const mongod = `${__dirname}/${version}/mongod`;
  if (!fs.existsSync(mongod)) {
    dl(version);
  }

  execSync('mkdir -p ./data');
  if (commander.keep) {
    console.log(chalk.blue('Skipping purge'));
  } else {
    console.log(chalk.blue('Purging database...'));
    execSync('rm -rf ./data/*');
    execSync('mkdir -p ./data/27017');
    execSync('mkdir -p ./data/27018');
    execSync('mkdir -p ./data/27019');
  }
  console.log(`Running '${mongod}'`);
  const rs = new ReplSet(mongod, [
    { port: 27017, dbpath: `${process.cwd()}/data/27017` },
    { port: 27018, dbpath: `${process.cwd()}/data/27018` },
    { port: 27019, dbpath: `${process.cwd()}/data/27019` }
  ].map(opts => ({
    options: Object.assign(opts, { bind_ip: 'localhost' })
  })), { replSet: 'rs' });

  if (commander.keep) {
    console.log(chalk.blue('Restarting replica set...'));
    for (const manager of rs.managers) {
      yield manager.start();
    }
    yield rs.waitForPrimary();
  } else {
    console.log(chalk.blue('Starting replica set...'));
    yield rs.start();
  }

  console.log(chalk.green('Started replica set on "mongodb://localhost:27017,localhost:27018,localhost:27019"'));

  const client = yield mongodb.MongoClient.connect('mongodb://localhost:27017/test');

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

    let o = require('util').inspect(data.o);
    if ('o2' in data) {
      o = `${require('util').inspect(data.o2)} ${o}`;
    }
    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), data.ns, op, o);
  });
  oplog.on('error', err => {
    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), chalk.red(`Oplog error: ${err.stack}`));
  });
};
