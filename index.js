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
const options = require('./src/options');
const path = require('path');
const prettyjson = require('prettyjson');
const printHelp = require('./src/printHelp');
const spawn = require('child_process').spawn;
const os = require('os');

let ports = [];
const isWin = process.platform === 'win32';
let hostname = '';

for (const o of options) {
  commander.option(o.option, o.description);
}

commander.parse(process.argv);

co(run).catch(error => console.error(chalk.red(error.stack)));

function* run() {
  if ('--help' in commander.rawArgs) {
    printHelp();
    return;
  }

  const options = {};
  const rcfile = isWin ? `${process.cwd()}\\.run-rs.rc` : `${process.cwd()}/.run-rs.rc`;
  if (fs.existsSync(rcfile)) {
    Object.assign(options, JSON.parse(fs.readFileSync(rcfile, 'utf8')));
  }
  const version = typeof commander.version === 'string' ?
    commander.version :
    options.version || '4.0.6';

  const n = parseInt(commander.number, 10) || 3;
  const startingPort = parseInt(commander.portStart, 10) || 27017;

  for (let i = 0; i < n; ++i) {
    ports.push(startingPort + i);
  }

  if(commander.host) {
    hostname = `${commander.host}`;
  }
  else {
    hostname = isWin ? os.hostname() : 'localhost';
  }
  let mongod;
  let mongo;
  if (commander.mongod) {
    mongod = typeof commander.mongod === 'string' ? commander.mongod : 'mongod';
    mongo = typeof commander.mongod === 'string' ?
      commander.mongod.replace(/mongod$/i, 'mongo') :
      'mongo';
    if (!fs.existsSync(mongod)) {
      throw new Error(`No mongod process found at ${path.join(process.cwd(), 'mongod')}, check your --mongod option`);
    }
  } else {
    mongod = isWin ? `${__dirname}\\${version}\\mongod.exe` : `${__dirname}/${version}/mongod`;
    mongo = isWin ? `${__dirname}\\${version}\\mongo.exe` : `${__dirname}/${version}/mongo`;

    if (!fs.existsSync(mongod)) {
      dl(version);
    }
  }

  let dbPath;
  if(typeof commander.dbpath === 'string'){
     dbPath = `${commander.dbpath}` ;
  }
  else {
     dbPath = isWin ? 'data' : './data';
  }

  if (!fs.existsSync(`${dbPath}`)) {
    execSync(isWin ? `md .\\${dbPath}` : `mkdir -p ${dbPath}`);
  }
  if (commander.keep) {
    console.log(chalk.blue('Skipping purge'));
  } else {
    console.log(chalk.blue('Purging database...'));
    execSync(isWin ? `del /S /Q .\\${dbPath}\\*` : `rm -rf ${dbPath}/*`);
  }

  ports.forEach((port) => {
    let portDBPath = isWin ? `${dbPath}\\${port}` : `${dbPath}/${port}`;
    if(!fs.existsSync(portDBPath)) {
      execSync(isWin ? `md .\\${dbPath}\\${port}` : `mkdir -p ${dbPath}/${port}`);
    }
  });

  console.log(`Running '${mongod}'`, ports);
  const rs = new ReplSet(mongod,
    ports.map(port => ({
      options: {
        port: port,
        dbpath: isWin ? `${process.cwd()}\\${dbPath}\\${port}` : `${process.cwd()}/${dbPath}/${port}`,
        bind_ip: hostname
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
      yield startRS(rs);
    }
  } else {
    console.log(chalk.blue('Starting replica set...'));
    yield startRS(rs);
  }

  const hosts = ports.map(port => `${hostname}:${port}`);
  console.log(chalk.green(`Started replica set on "mongodb://${hosts.join(',')}?replicaSet=rs"`));

  if (commander.shell) {
    console.log(chalk.blue(`Running mongo shell: ${mongo}`));
    const shellDefaultHost = (hosts[0].split(':'))[0];
    const shellDefaultPort = (hosts[0].split(':'))[1];
    spawn(mongo,
      isWin ? ['--quiet','--port', shellDefaultPort, '--host', shellDefaultHost] : ['--quiet'],
      { stdio: 'inherit' }
    );
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

function startRS(rs) {
  return co(function*() {
    try {
      yield rs.start();
    } catch (err) {
      if (err.message.includes('SocketException: Address already in use')) {
        const match = err.message.match(/port: (\d+)/);
        if (match != null) {
          throw new Error(`Could not start mongod on port ${match[1]} because it is already in use`);
        }
      }
      throw err;
    }
  });
}
