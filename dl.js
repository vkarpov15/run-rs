'use strict';

const execSync = require('child_process').execSync;

module.exports = function dl(version = '3.6.5') {
  const os = getOS();
  const filename = os === 'osx' ?
    `mongodb-${getOS()}-ssl-x86_64-${version}.tgz` :
    `mongodb-${getOS()}-x86_64-${version}.tgz`;
  const dirname = `mongodb-${getOS()}-x86_64-${version}`;

  console.log(`Downloading MongoDB ${version}`);
  execSync(`curl -OL http://downloads.mongodb.org/${getOS()}/${filename}`);
  execSync(`tar -zxvf ${filename}`);
  execSync(`mv ./${dirname}/bin ${__dirname}/${version}`);
  execSync(`rm -rf ./${dirname}`);
  execSync(`rm ./${filename}`);
  console.log(`Copied MongoDB ${version} to '${__dirname}/${version}'`);
};

function getOS() {
  const os = require('os');

  switch (os.type()) {
    case 'Linux': return 'linux';
    case 'Darwin': return 'osx';
    default: throw new Error(`Unrecognized os ${type}`);
  }
}
