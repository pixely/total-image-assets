const puppeteer = require('puppeteer');
const yargs = require('yargs');

const { isValidURL } = require('./src/utils');
const reporter = require('./src/reporter');

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
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const { url } = argv;

  if (!isValidURL(url)) {
    reporter.fatalError(`"${url}" is not a valid URL`);
  }

  reporter.info(`Parsing ${url} for all potential images`);

  await page.goto(url);

  if (!page) {
    reporter.fatalError(`Invalid response from ${url}. Unable to parse.`);
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

  const uniqueImages = dedupImages(allImages);

  let filteredImages = null;
  if (argv.filter) {
    filteredImages = filterImages(uniqueImages, argv.filter);
  }

  const images = filteredImages || uniqueImages;

  reporter.auditInfo(
    allImages.length,
    uniqueImages.length,
    filteredImages ? filteredImages.length : filteredImages,
  );

  if (images.length === 0) {
    reporter.fatalError('No potential images found');
  }

  const progress = reporter.startProgress(images.length);

  const sizes = [];

  // Disable to allow us to throttle async requests
  // eslint-disable-next-line no-restricted-syntax
  for (const image of images) {
    reporter.updateProgress(progress);

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
    } catch (error) {
      reporter.error(error);
    }
  }

  reporter.finishProgress(progress);

  const totalSize = sizes.reduce((acc, cur) => acc + cur.size, 0);

  reporter.showResults(
    sizes.length,
    totalSize,
  );

  await browser.close();
})();
