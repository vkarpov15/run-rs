'use strict';

const options = require('./options');

module.exports = () => console.log(`
Usage: run-rs [options]

Options:

${stringifyOptions()}
`);

function stringifyOptions() {
  const maxLen = options.reduce((cur, opt) => Math.max(cur, opt.option.length), 0);
  return options.
    map(opt => `${padEnd(opt.option, maxLen)}  ${opt.description}`).
    map(line => '  ' + line).
    join('\n');
}

function padEnd(str, len) {
  while (str.length < len) {
    str = str + ' ';
  }
  return str;
}