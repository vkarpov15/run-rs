'use strict';

const execSync = require('child_process').execSync;

const version = '3.6.5';

const dirname = `mongodb-${getOS()}-x86_64-${version}`;
const filename = `${dirname}.tgz`;

console.log(`Downloading MongoDB ${version}`);
execSync(`curl -Ol http://downloads.mongodb.org/${getOS()}/${filename}`);
execSync(`tar -zxvf ${filename}`);
execSync(`mv ./${dirname}/bin ${__dirname}/node_modules/.bin/${version}`);
execSync(`rm -rf ./${dirname}`);
execSync(`rm ./${filename}`);
console.log(`Copied MongoDB ${version} to './node_modules/.bin/${version}'`);

function getOS() {
  const os = require('os');

  switch (os.type()) {
    case 'Linux': return 'linux';
    case 'Darwin': return 'osx';
    default: throw new Error(`Unrecognized os ${type}`);
  }
}
