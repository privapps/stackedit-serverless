const path = require('path');
const webpack = require('webpack');
const utils = require('./utils');
const config = require('../config');
const { VueLoaderPlugin } = require('vue-loader');
const vueLoaderConfig = require('./vue-loader.conf');

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

module.exports = {
  entry: {
    app: './src/',
  },
  output: {
    path: config.build.assetsRoot,
    filename: '[name].js',
    publicPath: process.env.NODE_ENV === 'production'
      ? config.build.assetsPublicPath
      : config.dev.assetsPublicPath,
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
    alias: {
      '@': resolve('src'),
      'vue$': '@vue/compat',
    },
    fallback: {
      // jison-generated parsers bundled by mermaid reference 'fs' even
      // though the code path is never reached in the browser
      fs: false,
      // markdown-it-imsize's disk-based image lookup (fs/path) is an
      // optional codepath this project never calls (size is always
      // taken from the markdown syntax, not disk)
      path: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: vueLoaderConfig,
      },
      // We can't pass graphlibrary to babel
      {
        test: /\.js$/,
        loader: 'string-replace-loader',
        include: [
          resolve('node_modules/graphlibrary'),
        ],
        options: {
          search: '^\\s*(?:let|const) ',
          replace: 'var ',
          flags: 'gm',
        },
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: [
          resolve('src'),
          resolve('test'),
          resolve('node_modules/mermaid'),
        ],
        exclude: [
          resolve('node_modules/mermaid/src/diagrams/class/parser'),
          resolve('node_modules/mermaid/src/diagrams/flowchart/parser'),
          resolve('node_modules/mermaid/src/diagrams/gantt/parser'),
          resolve('node_modules/mermaid/src/diagrams/git/parser'),
          resolve('node_modules/mermaid/src/diagrams/sequence/parser'),
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        type: 'asset',
        parser: {
          dataUrlCondition: { maxSize: 10000 },
        },
        generator: {
          filename: utils.assetsPath('img/[name].[contenthash:7][ext]'),
        },
      },
      {
        test: /\.(ttf|eot|otf|woff2?)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: utils.assetsPath('fonts/[name].[contenthash:7][ext]'),
        },
      },
      {
        test: /\.(md|yml|html)$/,
        loader: 'raw-loader',
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(require('../package.json').version),
    }),
  ],
};
