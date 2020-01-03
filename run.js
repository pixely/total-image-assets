const puppeteer = require('puppeteer');
const consola = require('consola');
const cliProgress = require('cli-progress');
const yargs = require('yargs');

const { isValidURL } = require('./src/utils');

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

consola.log(argv);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const { url } = argv;

  if (!isValidURL(url)) {
    consola.fatal(`"${url}" is not a valid URL`);
    process.exit();
  }

  consola.info(`Parsing ${url} for all potential images`);

  await page.goto(url);

  if (!page) {
    consola.fatal(`Invalid response from ${url}. Unable to parse.`);
    process.exit();
  }

  const extractSrcset = (srcset) => srcset.split(/,| /).filter((src) => src.includes('//')).map((src) => src.trim());

  const findImages = async () => {
    const src = await page.$$eval('[src]', (images) => Array.from(images).map((image) => image.src));
    const dataSrc = await page.$$eval('[data-src]', (images) => Array.from(images).map((image) => image.dataset.src));
    const content = await page.$$eval('[content]', (images) => Array.from(images).map((image) => image.content));
    const href = await page.$$eval('[href]', (images) => Array.from(images).map((image) => image.href));
    const srcset = await page.$$eval('[srcset]', (images) => Array.from(images).map((image) => image.srcset));
    const dataSrcset = await page.$$eval('[data-srcset]', (images) => Array.from(images).map((image) => image.dataset.srcset));

    const extractedSrcsetUrls = [...srcset, ...dataSrcset]
      .map((i) => extractSrcset(i)).reduce((acc, cur) => [...acc, ...cur], []);

    return [...src, ...dataSrc, ...content, ...href, ...extractedSrcsetUrls].filter(isValidURL);
  };

  const dedupImages = (images) => Array.from(new Set(images));

  const filterImages = (images) => images
    .filter((imageUrl) => imageUrl.match(new RegExp(argv.filter)));

  const allImages = await findImages();

  consola.log('');
  consola.success('Found:');
  consola.info(`- ${allImages.length} potential images`);
  const uniqueImages = dedupImages(allImages);
  consola.info(`- ${uniqueImages.length} unique potential images`);

  let images = [];
  if (argv.filter) {
    images = filterImages(uniqueImages, argv.filter);
    consola.info(`- ${images.length} unique potential images matching filter "${argv.filter}"`);
  } else {
    images = uniqueImages;
  }

  consola.log('');
  consola.log('📸  Auditing image sizes');
  consola.log('');

  if (images.length === 0) {
    consola.error('No potential images found');
    process.exit();
  }

  const progress = new cliProgress.SingleBar({
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic);

  consola.pauseLogs();

  progress.start(images.length, 0);
  const sizes = [];

  // Disable to allow us to throttle async requests
  // eslint-disable-next-line no-restricted-syntax
  for (const image of images) {
    progress.increment();
    let imageRequest;
    try {
      // Disable to allow us to wait for the page to load - we intentionally
      // don't want to fire all requests off asyncronously
      // eslint-disable-next-line no-await-in-loop
      imageRequest = await page.goto(image);

      if (imageRequest !== null
          && imageRequest.headers()['content-type']
          && imageRequest.headers()['content-type'].includes('image/')
      ) {
        sizes.push({
          url: imageRequest.url(),
          size: parseInt(imageRequest.headers()['content-length'], 10),
        });
      }
    } catch (err) {
      consola.log(imageRequest);
      consola.error(image, err);
    }
  }

  progress.stop();
  consola.resumeLogs();
  consola.log('');

  const totalSize = sizes.reduce((acc, cur) => acc + cur.size, 0);
  const totalSizeMb = Math.round((totalSize / 1000 / 1000) * 100) / 100;

  consola.log('📸  Audit results');
  consola.log('');
  consola.success(`Total images: ${sizes.length}`);
  consola.success(`Combined size: ${totalSizeMb}mb (${totalSize} bytes)`);

  await browser.close();
})();
