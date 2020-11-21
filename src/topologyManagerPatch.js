'use strict';

const Server = require('mongodb-topology-manager').Server;
const clone = require('mongodb-topology-manager/lib/utils').clone;
const co = require('co');
const f = require('util').format;
const spawn = require('child_process').spawn;
const waitForAvailable = require('mongodb-topology-manager/lib/utils').waitForAvailable;

Server.prototype.start = function() {
  var self = this;

  return new Promise(function(resolve, reject) {
    co(function*() {
      // Get the version numbers
      var result = yield self.discover();
      var version = result.version;

      // All errors found during validation
      var errors = [];

      // Ensure basic parameters
      if (!self.options.dbpath) {
        errors.push(new Error('dbpath is required'));
      }

      // Do we have any errors
      if (errors.length > 0) return reject(errors);

      // Figure out what special options we need to pass into the boot script
      // Removing any non-compatible parameters etc.
      if (version[0] === 3 && version[1] >= 0 && version[1] <= 2) {
        // do nothing
      } else if (version[0] === 3 && version[1] >= 2) {
        // do nothing
      } else if (version[0] === 2 && version[1] <= 6) {
        // do nothing
      }

      // Merge in all the options
      var options = clone(self.options);

      // Build command options list
      var commandOptions = [];

      // Do we have a 2.2 server, then we don't support setParameter
      if (version[0] === 2 && version[1] === 2) {
        delete options['setParameter'];
      }

      // Go over all the options
      for (var name in options) {
        if (options[name] == null) {
          commandOptions.push(f('--%s', name));
        } else if (Array.isArray(options[name])) {
          // We have an array of a specific option f.ex --setParameter
          for (var i = 0; i < options[name].length; i++) {
            var o = options[name][i];

            if (o == null) {
              commandOptions.push(f('--%s', name));
            } else {
              commandOptions.push(f('--%s=%s', name, options[name][i]));
            }
          }
        } else {
          commandOptions.push(f('--%s=%s', name, options[name]));
        }
      }

      // Command line
      var commandLine = f('%s %s', self.binary, commandOptions.join(' '));
      // Emit start event
      self.emit('state', {
        event: 'start',
        topology: 'server',
        cmd: commandLine,
        options: self.options
      });

      if (self.logger.isInfo()) {
        self.logger.info(f('started mongod with [%s]', commandLine));
      }

      // Spawn a mongod process
      self.process = spawn(self.binary, commandOptions);

      // Variables receiving data
      var stdout = '';
      var stderr = '';

      // Get the stdout
      self.process.stdout.on('data', function(data) {
        stdout += data.toString();
        self.emit('state', {
          event: 'stdout',
          topology: 'server',
          stdout: data.toString(),
          options: self.options
        });

        //
        // Only emit event at start
        if (self.state === 'stopped') {
          // Hack for MongoDB 4.4 re: gh-53
          if (
            stdout.indexOf('aiting for connections') !== -1 ||
            stdout.indexOf('connection accepted') !== -1
          ) {
            waitForAvailable(self.options.bind_ip, self.options.port, err => {
              if (err) return reject(err);

              // Mark state as running
              self.state = 'running';

              // Emit start event
              self.emit('state', {
                event: 'running',
                topology: 'server',
                cmd: commandLine,
                options: self.options
              });

              // Resolve
              resolve();
            });
          }
        }
      });

      // Get the stderr
      self.process.stderr.on('data', function(data) {
        stderr += data;
      });

      // Got an error
      self.process.on('error', function(err) {
        self.emit('state', {
          event: 'sterr',
          topology: 'server',
          stdout: stdout,
          stedrr: stderr.toString(),
          options: self.options
        });
        reject(new Error({ error: err, stdout: stdout, stderr: stderr }));
      });

      // Process terminated
      self.process.on('close', function(code) {
        if ((self.state === 'stopped' && stdout === '') || code !== 0) {
          return reject(
            new Error(f('failed to start mongod with options %s\n%s', commandOptions, stdout))
          );
        }

        self.state = 'stopped';
      });
    }).catch(reject);
  });
};