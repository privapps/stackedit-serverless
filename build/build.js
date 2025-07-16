require('./check-versions')()

process.env.NODE_ENV = 'production'

var ora = require('ora').default
var fs = require('fs')
var path = require('path')
const chalk = require('chalk');
var webpack = require('webpack')
var config = require('../config')
var webpackConfig = require('./webpack.prod.conf')

var spinner = ora('building for production...')
spinner.start()

fs.rm(path.join(config.build.assetsRoot, config.build.assetsSubDirectory), { recursive: true, force: true }, err => {
  if (err) throw err
  webpack(webpackConfig, function (err, stats) {
    spinner.stop()
    if (err) throw err
    process.stdout.write(stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }) + '\n\n')

    console.log(chalk.default.cyan('  Build complete.\n'))
    console.log(chalk.default.yellow(
      '  Tip: built files are meant to be served over an HTTP server.\n' +
      '  Opening index.html over file:// won\'t work.\n'
    ))
  })
})
