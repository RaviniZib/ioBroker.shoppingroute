const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.beta-package-staging');
const outDir = path.join(root, 'beta-package');
const pkg = require(path.join(root, 'package.json'));
const version = pkg.version;

function rm(target) {
    fs.rmSync(target, { recursive: true, force: true });
}

function copyFile(rel) {
    const src = path.join(root, rel);
    const dst = path.join(stage, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function copyDir(srcRel, dstRel = srcRel) {
    fs.cpSync(path.join(root, srcRel), path.join(stage, dstRel), { recursive: true });
}

function walkJs(dir) {
    const result = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walkJs(full));
        else if (entry.isFile() && full.endsWith('.js')) result.push(full);
    }
    return result;
}

rm(stage);
rm(outDir);
fs.mkdirSync(stage, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of [
    'io-package.json',
    'LICENSE',
    'README.md',
    'README_DE.md',
    'BETA_TESTING.md',
    'BETA_TESTING_DE.md',
    'BETA_LICENSE.md',
    'BETA_LICENSE_DE.md',
    'BETA_INSTALL_DE.md',
    'BETA_TESTER_AUFRUF_DE.md',
]) copyFile(file);
copyDir('admin');

fs.mkdirSync(path.join(stage, 'build'), { recursive: true });
for (const sourceFile of walkJs(path.join(root, 'build'))) {
    const relative = path.relative(path.join(root, 'build'), sourceFile);
    const target = path.join(stage, 'build', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const source = fs.readFileSync(sourceFile, 'utf8');
    const obfuscated = JavaScriptObfuscator.obfuscate(source, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        renameProperties: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: false,
        stringArrayEncoding: [],
        stringArrayThreshold: 0.65,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
    }).getObfuscatedCode();
    fs.writeFileSync(target, obfuscated + '\n');
}

const testerPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
// Direct publishing from the development repository is blocked by prepublishOnly.
// The generated tester tarball removes all scripts and remains publishable to npm.
delete testerPackage.private;
testerPackage.scripts = {};
delete testerPackage.devDependencies;
testerPackage.files = [
    'admin', 'build', 'io-package.json', 'LICENSE', 'README.md', 'README_DE.md',
    'BETA_TESTING.md', 'BETA_TESTING_DE.md', 'BETA_LICENSE.md', 'BETA_LICENSE_DE.md',
    'BETA_INSTALL_DE.md', 'BETA_TESTER_AUFRUF_DE.md',
];
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(testerPackage, null, 2) + '\n');

const pack = spawnSync('npm', ['pack', stage, '--pack-destination', outDir], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
});
if (pack.status !== 0) process.exit(pack.status || 1);

const generated = fs.readdirSync(outDir).filter(name => name.endsWith('.tgz'));
if (generated.length !== 1) throw new Error(`Expected exactly one tgz, found ${generated.length}`);
console.log(`Public beta package created: ${path.join(outDir, generated[0])}`);
console.log('Package contains no TypeScript sources, tests, GitHub workflow files or source maps. Runtime JavaScript is obfuscated.');
console.log(`Version: ${version}`);
