#!/usr/bin/node

'use strict';

const chalk = require('chalk');
const co = require('co');
const execSync = require('child_process').execSync;
const moment = require('moment');
const mongodb = require('mongodb');
const ReplSet = require('mongodb-topology-manager').ReplSet;

const version = '3.6.5';

co(run).catch(error => console.error(error.stack));

function* run() {
  execSync('mkdir -p ./data');
  execSync('rm -rf ./data/*');
  execSync('mkdir -p ./data/27017');
  execSync('mkdir -p ./data/27018');
  execSync('mkdir -p ./data/27019');
  const mongod = `${__dirname}/${version}/mongod`;
  console.log(`Running '${mongod}'`);
  const rs = new ReplSet(mongod, [
    { port: 27017, dbpath: `${process.cwd()}/data/27017` },
    { port: 27018, dbpath: `${process.cwd()}/data/27018` },
    { port: 27019, dbpath: `${process.cwd()}/data/27019` }
  ].map(opts => ({
    options: Object.assign(opts, { bind_ip: 'localhost' })
  })), { replSet: 'rs' });

  console.log(chalk.blue('Starting replica set...'));

  yield rs.start();

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
  })
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
  })
  oplog.on('error', err => {
    console.log(moment().format('YYYY-MM-DD HH:mm:ss'), chalk.red(`Oplog error: ${err.stack}`));
  })
};
