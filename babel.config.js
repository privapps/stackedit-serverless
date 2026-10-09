module.exports = {
  presets: [
    ['@babel/preset-env', {
      modules: false,
      useBuiltIns: 'usage',
      corejs: 3,
    }],
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
      ],
    },
  },
};
