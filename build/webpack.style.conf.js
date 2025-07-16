var path = require('path')
var utils = require('./utils')
var webpack = require('webpack')
var utils = require('./utils')
var config = require('../config')
var vueLoaderConfig = require('./vue-loader.conf')
var StylelintPlugin = require('stylelint-webpack-plugin')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')

function resolve (dir) {
  return path.join(__dirname, '..', dir)
}

module.exports = {
  entry: {
    style: './src/styles/'
  },
  mode: 'production',
  module: {
    rules: [{
      test: /\.(ttf|eot|otf|woff2?)(\?.*)?$/,
      loader: 'file-loader',
      options: {
        name: utils.assetsPath('fonts/[name].[hash:7].[ext]')
      }
    }]
    .concat(utils.styleLoaders({
      sourceMap: config.build.productionSourceMap,
      extract: true
    })),
  },
  output: {
    path: config.build.assetsRoot,
    filename: '[name].js',
    publicPath: config.build.assetsPublicPath
  },
  optimization: {
    minimize: true,
    minimizer: [
      // Use webpack's built-in TerserPlugin for minification
      '...',
    ],
  },
  plugins: [
    // extract css into its own file
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ]
}
