import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.git')) {
  process.exit(0);
}

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('Git hooks installed from .githooks');
} catch {
  console.warn('Could not install git hooks. Run: git config core.hooksPath .githooks');
}
