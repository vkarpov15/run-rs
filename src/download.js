'use strict';

const path = require('path');

const execSync = require('child_process').execSync;

module.exports = function download(version) {
  const versionMatch = version.match(/^(\d)\.(\d)\.(\d+)$/);
  if (!versionMatch) {
    throw new Error('Version must be in x.x.x format');
  }
  const major = parseInt(versionMatch[1]);
  // const minor = parseInt(versionMatch[2]);
  // const patch = parseInt(versionMatch[3]);

  let os = process.platform;
  let dirname;
  let filename;
  const mainScriptDir = path.resolve(__dirname, '..');

  switch (os) {
    case 'linux':
      filename = `mongodb-linux-x86_64-${version}.tgz`;
      dirname = `mongodb-linux-x86_64-${version}`;
      break;
    case 'darwin':
      os = 'osx';
      filename = `mongodb-osx-ssl-x86_64-${version}.tgz`;
      dirname = `mongodb-osx-x86_64-${version}`;
      break;
    case 'win32':
      if (major < 3) {
        filename = `mongodb-win32-x86_64-2008plus-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2008plus-${version}`;
      } else {
        filename = `mongodb-win32-x86_64-2008plus-ssl-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2008plus-ssl-${version}`;
      }
      break;
    default:
      throw new Error(`Unrecognized os ${os}`);
  }

  if (os === 'win32') {
    execSync('powershell.exe -nologo -noprofile -command "&{' +
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;' +
      `(New-Object Net.WebClient).DownloadFile('http://downloads.mongodb.org/${os}/${filename}', '${filename}');` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${filename}','.');` +
      `mv './${dirname}/bin' '${mainScriptDir}/${version}';` +
      `rd -r './${dirname}';` +
      `rm './${filename}';` +
      '}"'
    );
  } else {
    execSync(`curl -OL http://downloads.mongodb.org/${os}/${filename}`);
    execSync(`tar -zxvf ${filename}`);
    execSync(`mv ./${dirname}/bin ${mainScriptDir}/${version}`);
    execSync(`rm -rf ./${dirname}`);
    execSync(`rm ./${filename}`);
  }

  return { path: `${mainScriptDir}/${version}` };
};
