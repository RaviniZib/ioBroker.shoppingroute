'use strict';

const { version } = require('../package.json');

const stableVersion = /^\d+\.\d+\.\d+$/.test(version);
const expectedRef = `refs/tags/v${version}`;

const allowedStableGithubPublish =
    process.env.GITHUB_ACTIONS === 'true' &&
    process.env.GITHUB_REPOSITORY === 'RaviniZib/ioBroker.shoppingroute' &&
    process.env.GITHUB_REF === expectedRef &&
    stableVersion;

if (allowedStableGithubPublish) {
    console.log(`Official stable GitHub release publish allowed for ${version}.`);
    process.exit(0);
}

console.error(
    'Direct npm publish from the development repository is blocked. ' +
    'Stable releases are published only by the official GitHub release workflow.'
);
process.exit(1);
