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

commander.
  option('-v, --version [version]', 'Version to use').
  option('-k, --keep', 'Use this flag to skip clearing the database on startup').
  option('-s, --shell', 'Use this flag to automatically open up a MongoDB shell when the replica set is started').
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
    options.version || '3.6.5';

  const mongod = `${__dirname}/${version}/mongod`;
  const mongo = `${__dirname}/${version}/mongo`;
  if (!fs.existsSync(mongod)) {
    dl(version);
  }

  execSync('mkdir -p ./data');
  if (commander.keep) {
    console.log(chalk.blue('Skipping purge'));
  } else {
    console.log(chalk.blue('Purging database...'));
    execSync('rm -rf ./data/*');
  }

  execSync('mkdir -p ./data/27017');
  execSync('mkdir -p ./data/27018');
  execSync('mkdir -p ./data/27019');

  console.log(`Running '${mongod}'`);
  const rs = new ReplSet(mongod, [
    { port: 27017, dbpath: `${process.cwd()}/data/27017` },
    { port: 27018, dbpath: `${process.cwd()}/data/27018` },
    { port: 27019, dbpath: `${process.cwd()}/data/27019` }
  ].map(opts => ({
    options: Object.assign(opts, { bind_ip: '127.0.0.1' })
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

  console.log(chalk.green('Started replica set on "mongodb://localhost:27017,localhost:27018,localhost:27019?replicaSet=rs"'));

  if (commander.shell) {
    console.log(chalk.blue(`Running mongo shell: ${mongo}`));
    spawn(mongo, ['--quiet'], { stdio: 'inherit' });
  } else {
    const client = yield mongodb.MongoClient.connect('mongodb://localhost:27017/test', {
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
};
