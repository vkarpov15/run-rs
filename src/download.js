'use strict';

const childProcess = require('child_process');
const fs = require('fs');
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
      } else if (major <= 4 && minor < 4) {
        filename = `mongodb-win32-x86_64-2012plus-${version}.zip`;
        dirname = `mongodb-win32-x86_64-2012plus-${version}`;
      } else {
        os = 'windows';
        filename = `mongodb-windows-x86_64-${version}.zip`;
        dirname = `mongodb-win32-x86_64-windows-${version}`;
      }
      break;
    default:
      throw new Error(`Unrecognized os ${os}`);
  }

  const url = `${base}/${os}/${filename}`;

  if (os.startsWith('win')) {
    execSync('powershell.exe -nologo -noprofile -command "&{' +
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;' +
      `(New-Object Net.WebClient).DownloadFile('${url}', '${filename}');` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${filename}', '.');` +
    '}"');
  } else {
    execSync(`curl -OL ${url}`);
    execSync(`tar -zxvf ${filename}`);
  }

  const targetDir = path.join(mainScriptDir, version);

  fs.rmSync(targetDir, { force: true, recursive: true })
  fs.renameSync(
    path.join(process.cwd(), dirname, 'bin'),
    targetDir
  );
  fs.rmSync(path.join(process.cwd(), dirname), { force: true, recursive: true });
  fs.rmSync(path.join(process.cwd(), filename));

  return { path: path.join(mainScriptDir, version), url };
};
