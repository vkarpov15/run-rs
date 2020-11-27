'use strict';

const childProcess = require('child_process');
const path = require('path');

module.exports = function download(version, systemLinux, os) {
  const execSync = childProcess.execSync;
  const versionMatch = version.match(/^(\d)\.(\d)\.(\d+)$/);
  if (!versionMatch) {
    throw new Error('Version must be in x.x.x format');
  }
  const major = parseInt(versionMatch[1]);
  const minor = parseInt(versionMatch[2]);
  // const patch = parseInt(versionMatch[3]);

  os = os || process.platform;
  let dirname;
  let filename;
  let base = 'https://downloads.mongodb.org';

  const mainScriptDir = path.resolve(__dirname, '..');
  const isBefore42 = major < 4 || (major === 4 && minor < 2);

  switch (os) {
    case 'linux':
      if (isBefore42) {
        filename = `mongodb-linux-x86_64-${version}.tgz`;
        dirname = `mongodb-linux-x86_64-${version}`;
      } else {
        filename = `mongodb-linux-x86_64-${systemLinux}-${version}.tgz`;
        dirname = `mongodb-linux-x86_64-${systemLinux}-${version}`;
      }
      break;
    case 'darwin':
      os = 'osx';
      if (isBefore42) {
        filename = `mongodb-osx-ssl-x86_64-${version}.tgz`;
        dirname = `mongodb-osx-x86_64-${version}`;
      } else {
        base = 'https://fastdl.mongodb.org';
        filename = `mongodb-macos-x86_64-${version}.tgz`;
        dirname = `mongodb-macos-x86_64-${version}`;
      }
      break;
    case 'win32':
      if (major < 3) {
        filename = `mongodb-win32-x86_64-2008plus-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2008plus-${version}`;
      } else if (major <= 4 && minor < 2) {
        filename = `mongodb-win32-x86_64-2008plus-ssl-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2008plus-ssl-${version}`;
      } else {
        filename = `mongodb-win32-x86_64-2012plus-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2012plus-${version}`;
      }
      break;
    default:
      throw new Error(`Unrecognized os ${os}`);
  }

  const url = `${base}/${os}/${filename}`;

  if (os === 'win32') {
    execSync('powershell.exe -nologo -noprofile -command "&{' +
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;' +
      `(New-Object Net.WebClient).DownloadFile('${url}', '${filename}');` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${filename}','.');` +
      `mv './${dirname}/bin' '${mainScriptDir}/${version}';` +
      `rd -r './${dirname}';` +
      `rm './${filename}';` +
      '}"'
    );
  } else {
    execSync(`curl -OL ${url}`);
    execSync(`tar -zxvf ${filename}`);
    execSync(`mv ./${dirname}/bin ${mainScriptDir}/${version}`);
    execSync(`rm -rf ./${dirname}`);
    execSync(`rm ./${filename}`);
  }

  return { path: `${mainScriptDir}/${version}`, url: url };
};
