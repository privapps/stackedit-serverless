require('./check-versions')();

process.env.NODE_ENV = 'production';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const config = require('../config');
const webpackConfig = require('./webpack.prod.conf');

console.log('building for production...');

fs.rmSync(path.join(config.build.assetsRoot, config.build.assetsSubDirectory), {
  recursive: true,
  force: true,
});

webpack(webpackConfig, (err, stats) => {
  if (err) throw err;
  process.stdout.write(`${stats.toString({
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false,
  })}\n\n`);

  if (stats.hasErrors()) {
    console.log('Build failed with errors.\n');
    process.exit(1);
  }

  console.log('Build complete.\n');
  console.log(
    'Tip: built files are meant to be served over an HTTP server.\n'
    + 'Opening index.html over file:// won\'t work.\n',
  );
});
