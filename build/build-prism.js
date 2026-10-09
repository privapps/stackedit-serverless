const fs = require('node:fs');
const path = require('node:path');

const prismComponents = require('prismjs/components.json');
const getPrismLoader = require('prismjs/dependencies');
const prismScripts = [
  require.resolve('prismjs/components/prism-core'),
  ...getPrismLoader(prismComponents, Object.keys(prismComponents.languages))
    .getIds()
    .filter(id => id !== 'meta')
    .map(id => require.resolve(`prismjs/components/prism-${id}`)),
];

fs.writeFileSync(
  path.join(path.dirname(require.resolve('prismjs')), 'prism.js'),
  prismScripts.map(script => fs.readFileSync(script, 'utf8')).join('\n'),
);
