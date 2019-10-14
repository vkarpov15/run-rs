'use strict';

const assert = require('assert');
const download = require('../src/download');
const sinon = require('sinon');

const childProcess = require('child_process');

describe('download', function() {
  beforeEach(function() {
    sinon.stub(childProcess, 'execSync').callsFake(() => {});
  });

  afterEach(function() {
    childProcess.execSync.restore();
  });

  it('basic download', function() {
    let { url } = download('4.0.6', 'ubuntu1604', 'linux');
    assert.equal(url, 'http://downloads.mongodb.org/linux/mongodb-linux-x86_64-4.0.6.tgz');

    ({ url } = download('4.2.0', 'ubuntu1604', 'linux'));
    assert.equal(url, 'http://downloads.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1604-4.2.0.tgz');
  });

  it('osx 4.2.0', function() {
    let { url } = download('4.2.0', null, 'darwin');
    assert.equal(url, 'https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-4.2.0.tgz');
  });

  it('osx < 4.2.0', function() {
    let { url } = download('4.0.6', null, 'darwin');
    assert.equal(url, 'http://downloads.mongodb.org/osx/mongodb-osx-ssl-x86_64-4.0.6.tgz');
  });
});
