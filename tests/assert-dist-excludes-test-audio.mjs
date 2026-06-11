import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const distDir = 'dist';
const disallowedPatterns = [/test-audio/i, /file_example_.*\.(mp3|ogg|wav)$/i];
const matches = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }

    const relativePath = relative(distDir, path);
    if (disallowedPatterns.some((pattern) => pattern.test(relativePath))) {
      matches.push(relativePath);
    }
  }
}

walk(distDir);

if (matches.length > 0) {
  console.error(`Test audio files must not be included in production builds:\n${matches.join('\n')}`);
  process.exit(1);
}

console.log('No test audio files found in dist.');
