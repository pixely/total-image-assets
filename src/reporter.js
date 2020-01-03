const consola = require('consola');
const cliProgress = require('cli-progress');

const totalSizeMb = (bytes) => Math.round((bytes / 1000 / 1000) * 100) / 100;

const info = (message) => {
  consola.info(message);
};

const auditInfo = (total, unique, filtered = null) => {
  consola.log('');
  consola.success('Found:');
  consola.info(`- ${total} potential images`);
  consola.info(`- ${unique} unique potential images`);

  if (filtered) {
    consola.info(`- ${filtered} unique potential images matching filter`);
  }

  consola.log('');
  consola.log('📸  Auditing image sizes');
  consola.log('');
};

const showResults = (totalRequests, totalSize) => {
  consola.log('📸  Audit results');
  consola.log('');
  consola.success(`Total images: ${totalRequests}`);
  consola.success(`Combined size: ${totalSizeMb(totalSize)}mb (${totalSize} bytes)`);
};

const startProgress = (max = 0) => {
  const progress = new cliProgress.SingleBar({
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic);

  consola.pauseLogs();

  progress.start(max, 0);
  return progress;
};

const updateProgress = (progress) => { progress.increment(); };

const finishProgress = (progress) => {
  progress.stop();
  consola.resumeLogs();
  consola.log('');
};

const error = (errorMessage) => {
  consola.error(errorMessage);
};

const fatalError = (message) => {
  consola.fatal(message);
  process.exit();
};

module.exports = {
  auditInfo,
  showResults,
  info,
  error,
  fatalError,
  startProgress,
  updateProgress,
  finishProgress,
};
