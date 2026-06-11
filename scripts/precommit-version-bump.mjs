import { execSync } from 'node:child_process';

if (process.env.SKIP_VERSION_BUMP === '1') {
  console.log('Skipping pre-commit version bump.');
  process.exit(0);
}

function stagedPackageVersionChanged() {
  try {
    const diff = execSync('git diff --cached -- package.json', { encoding: 'utf8' });
    return /^[-+]\s*"version":/m.test(diff);
  } catch {
    return false;
  }
}

if (stagedPackageVersionChanged()) {
  console.log('package.json already has a staged version change; leaving version as-is.');
  process.exit(0);
}

execSync('node scripts/bump-version.mjs patch', { stdio: 'inherit' });
execSync('git add package.json package-lock.json', { stdio: 'inherit' });
