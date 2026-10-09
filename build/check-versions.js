const semver = require('semver');
const { execSync } = require('child_process');
const packageConfig = require('../package.json');

function exec(cmd) {
  return execSync(cmd).toString().trim();
}

module.exports = function checkVersions() {
  const versionRequirements = [
    {
      name: 'node',
      currentVersion: semver.clean(process.version),
      versionRequirement: packageConfig.engines.node,
    },
    {
      name: 'npm',
      currentVersion: exec('npm --version'),
      versionRequirement: packageConfig.engines.npm,
    },
  ];

  const warnings = versionRequirements
    .filter(mod => !semver.satisfies(mod.currentVersion, mod.versionRequirement))
    .map(mod => `${mod.name}: ${mod.currentVersion} should be ${mod.versionRequirement}`);

  if (warnings.length) {
    console.log('');
    console.log('To build this project, you must update the following modules:');
    console.log();
    warnings.forEach((warning) => {
      console.log(`  ${warning}`);
    });
    console.log();
    process.exit(1);
  }
};
