const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const utils = require('./utils');
const config = require('../config');

module.exports = {
  mode: 'production',
  entry: {
    style: './src/styles/',
  },
  module: {
    rules: [{
      test: /\.(ttf|eot|otf|woff2?)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: utils.assetsPath('fonts/[name].[contenthash:7][ext]'),
      },
    }]
      .concat(utils.styleLoaders({
        sourceMap: config.build.productionSourceMap,
        extract: true,
        publicPath: './',
      })),
  },
  output: {
    path: config.build.assetsRoot,
    filename: '[name].js',
    publicPath: config.build.assetsPublicPath,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new CssMinimizerPlugin(),
    ],
  },
  plugins: [
    // extract css into its own file
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
};
