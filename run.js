const puppeteer = require('puppeteer');
const consola = require('consola');
const cliProgress = require('cli-progress');
const yargs = require('yargs');

const { argv } = yargs
  .command('lyr', 'Tells whether an year is leap year or not', {
    year: {
      description: 'the year to check for',
      alias: 'y',
      type: 'number',
    },
  })
  .option('time', {
    alias: 't',
    description: 'Tell the present Time',
    type: 'boolean',
  })
  .option('url', {
    alias: 'u',
    description: 'URL you want to parse',
    type: 'string',
  })
  .demandOption(['url'], 'Please provide a URL to parse')
  .help()
  .alias('help', 'h');

consola.log(argv);

const isValidURL = (string) => {
  const regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;
  return regexp.test(string);
};

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const { url } = argv;
  consola.info(`Parsing ${url} for all potential images`);

  await page.goto(url);




  const extractSrcset = (srcset) => srcset.split(/,| /).filter((src) => src.includes('//')).map((src) => src.trim());

  const extractImages = async (attribute) => Array.from(await page.$$(`[${attribute}]`));

  const isTachyonImage = (imageUrl) => imageUrl;

  // const isTachyonImage = imageUrl => imageUrl.includes('images.') && imageUrl.includes('.immediate.co.uk')
  // const isTachyonImage = imageUrl => imageUrl.match(/\bimages\.\w+\.immediate.co.uk\b/g);


  const findImages = async (handler) => {
    const src = await page.$$eval('[src]', (images) => Array.from(images).map((image) => image.src));
    const dataSrc = await page.$$eval('[data-src]', (images) => Array.from(images).map((image) => image.dataset.src));
    const content = await page.$$eval('[content]', (images) => Array.from(images).map((image) => image.content));
    const href = await page.$$eval('[href]', (images) => Array.from(images).map((image) => image.href));
    const srcset = await page.$$eval('[srcset]', (images) => Array.from(images).map((image) => image.srcset));
    const dataSrcset = await page.$$eval('[data-srcset]', (images) => Array.from(images).map((image) => image.dataset.srcset));

    const extractedSrcsetUrls = [...srcset, ...dataSrcset].map((i) => extractSrcset(i)).reduce((acc, cur) => [...acc, ...cur], []);

    // const content = extractImages('content').map(content => content.content );
    // const href = extractImages('href').map(href => href.href );
    // const srcsets = extractImages('srcset').map(srcset => extractSrcset(srcset.srcset)).reduce((acc, cur) => [...acc, ...cur],[]);
    // const dataSrcsets = extractImages('data-srcset').map(srcset => extractSrcset(srcset.dataset.srcset)).reduce((acc, cur) => [...acc, ...cur],[]);
    // return [...src];
    return [...src, ...dataSrc, ...content, ...href, ...extractedSrcsetUrls].filter(isValidURL);
    // return [...src, ...srcsets, ...content, ...href, ...dataSrc, ...dataSrcsets].filter(item => item);
  };

  const dedupImages = (images) => Array.from(new Set(images));
  const filterImages = (images) => images.filter(isTachyonImage);

  const allImages = await findImages();

  consola.log('');
  consola.success('Found:');
  consola.info(`- ${allImages.length} potential images`);
  const uniqueImages = dedupImages(allImages);
  consola.info(`- ${uniqueImages.length} unique potential images`);
  const images = filterImages(uniqueImages);
  consola.info(`- ${images.length} unique potential images matching filters`);
  consola.log('');
  consola.log('📸  Auditing image sizes');
  consola.log('');

  const progress = new cliProgress.SingleBar({
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic);

  consola.pauseLogs();

  progress.start(images.length, 0);
  const sizes = [];
  for (image of images) {
    progress.increment();
    let imageRequest;
    try {
      imageRequest = await page.goto(image);

      if (imageRequest !== null
          && imageRequest.headers()['content-type']
          && imageRequest.headers()['content-type'].includes('image/')
      ) {
        sizes.push({
          url: imageRequest.url(),
          size: parseInt(imageRequest.headers()['content-length']),
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
