const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');
const utils = require('./utils');
const config = require('../config');
const baseWebpackConfig = require('./webpack.base.conf');

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

const env = config.build.env;

const webpackConfig = merge(baseWebpackConfig, {
  mode: 'production',
  module: {
    rules: utils.styleLoaders({
      sourceMap: config.build.productionSourceMap,
      extract: true,
      publicPath: '../../',
    }),
  },
  devtool: config.build.productionSourceMap ? 'source-map' : false,
  output: {
    path: config.build.assetsRoot,
    filename: utils.assetsPath('js/[name].[chunkhash].js'),
    chunkFilename: utils.assetsPath('js/[id].[chunkhash].js'),
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      name: 'vendor',
    },
    runtimeChunk: {
      name: 'manifest',
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      NODE_ENV: env.NODE_ENV,
    }),
    // extract css into its own file
    new MiniCssExtractPlugin({
      filename: utils.assetsPath('css/[name].[contenthash].css'),
    }),
    // generate dist index.html with correct asset hash for caching.
    // you can customize output by editing /index.html
    // see https://github.com/jantimon/html-webpack-plugin
    new HtmlWebpackPlugin({
      filename: config.build.index,
      template: 'index.html',
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      },
    }),
    // copy custom static assets
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../static'),
          to: config.build.assetsSubDirectory,
          globOptions: {
            ignore: ['**/.*'],
          },
        },
      ],
    }),
    new FaviconsWebpackPlugin({
      logo: resolve('src/assets/favicon.png'),
      mode: 'webapp',
      favicons: {
        appName: 'StackEdit',
        appDescription: 'Full-featured, open-source Markdown editor',
        display: 'standalone',
        orientation: 'any',
        start_url: '../',
        scope: '../',
        background_color: '#ffffff',
      },
    }),
    new GenerateSW({
      clientsClaim: false,
      skipWaiting: false,
      cleanupOutdatedCaches: true,
      navigateFallback: 'index.html',
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    }),
  ],
});

if (config.build.bundleAnalyzerReport) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
  webpackConfig.plugins.push(new BundleAnalyzerPlugin());
}

module.exports = webpackConfig;
