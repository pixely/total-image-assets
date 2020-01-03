const yargs = require('yargs');

const puppeteer = require('./src/puppeteer');

const { argv } = yargs
  .command('total-image-requests', 'Parses a URL for all possible image requests', {
    url: {
      description: 'URL you want to parse',
      alias: 'url',
      type: 'string',
    },
  })
  .option('url', {
    alias: 'u',
    description: 'URL you want to parse',
    type: 'string',
  })
  .option('filter', {
    alias: 'f',
    description: 'RegularExpression used to filter your responses',
    type: 'string',
  })
  .demandOption(['url'], 'Please provide a URL to parse')
  .help()
  .alias('help', 'h');

(async () => {
  await puppeteer(argv.url, argv.filter);
})();
