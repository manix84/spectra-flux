import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const bump = process.argv[2] ?? 'auto';
const validBumps = new Set(['major', 'minor', 'patch', 'auto']);

if (!validBumps.has(bump)) {
  console.error('Usage: node scripts/bump-version.mjs [auto|patch|minor|major]');
  process.exit(1);
}

function getCommitSubjects() {
  try {
    return execSync('git log --format=%s -n 50', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function inferBump() {
  const subjects = getCommitSubjects();
  if (subjects.some((subject) => subject.includes('BREAKING CHANGE') || /^[a-z]+!:/i.test(subject))) {
    return 'major';
  }
  if (subjects.some((subject) => /^feat(\(.+\))?:/i.test(subject))) {
    return 'minor';
  }
  return 'patch';
}

function nextVersion(version, bumpType) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Unsupported semver version: ${version}`);
  }
  const [major, minor, patch] = parts;
  if (bumpType === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bumpType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

const packagePath = 'package.json';
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
const bumpType = bump === 'auto' ? inferBump() : bump;
const previousVersion = manifest.version;
manifest.version = nextVersion(previousVersion, bumpType);
writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

if (existsSync('package-lock.json')) {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  lock.version = manifest.version;
  if (lock.packages?.['']) {
    lock.packages[''].version = manifest.version;
  }
  writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
}

console.log(`${previousVersion} -> ${manifest.version} (${bumpType})`);
