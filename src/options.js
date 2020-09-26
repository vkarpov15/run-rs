'use strict';

module.exports = Object.freeze([
  { option: '-v, --version [version]', description: 'Version to use' },
  {
    option: '-k, --keep',
    description: 'Use this flag to skip clearing the database on startup'
  },
  {
    option: '-s, --shell',
    description: 'Use this flag to automatically open up a MongoDB shell when the replica set is started'
  },
  {
    option: '-q, --quiet',
    description: 'Use this flag to suppress any output after starting'
  },
  {
    option: '-m, --mongod [string]',
    description: 'Skip downloading MongoDB and use this executable. If blank, just uses `mongod`. For instance, `run-rs --mongod` is equivalent to `run-rs --mongod mongod`'
  },
  {
    option: '-n, --number [num]',
    description: 'Number of mongods in the replica set. 3 by default.'
  },
  {
    option: '-p, --portStart [num]',
    description: 'Start binding mongods contiguously from this port. 27017 by default.'
  },
  {
    option: '-d, --dbpath [string]',
    description: 'Specify a path for mongod to use as a data directory. `./data` by default.'
  },
  {
    option: '-h, --host [string]',
    description: 'Override the default ip binding and bind mongodb to listen to other ip addresses. Bind to localhost or 127.0.0.1 by default'
  },
  {
    option: '-l, --linux [string]',
    description: 'Override the default system linux. Only for linux version. `ubuntu1604` by default'
  },
  {
    option: '-p, --bind_ip_all',
    description: 'Allow connections from remote servers, not just from localhost.'
  },
  {
    option: '--help',
    description: 'Output help'
  }
]);
