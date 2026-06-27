/**
 * Dependency Declaration Validation
 *
 * Catches the dependency drift that `expo-doctor` does not: packages that are
 * USED but not declared in package.json (e.g. an undeclared `expo-sensors`), and
 * packages DECLARED but never used (e.g. a stale `tsx`). Wraps `depcheck` and
 * fails on any such finding, after subtracting a small, explicitly-documented
 * allowlist of known false positives for this Expo / React Native / TS project.
 *
 * Run with: npx tsx src/scripts/validateDepsDeclared.ts
 */

import depcheck from 'depcheck';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

// Known false positives — usages depcheck cannot statically see, so they are NOT
// real drift. Keep this list MINIMAL and documented; do not add a name here just
// to silence a real finding.
const IGNORE_MATCHES: string[] = [
  '@babel/preset-*', // referenced inline in jest.config.js `transform`, not imported
  '@types/*', // ambient type packages, never imported at runtime
  'expo-build-properties', // Expo config plugin (app.config.js), not imported
  'expo-health-connect', // Expo config plugin (app.config.js), not imported
  'expo-dev-client', // dev/build client loaded natively, not imported in source
  'react-native-screens', // required natively by @react-navigation, not imported directly
  'eslint-config-prettier', // ESLint config preset consumed by tooling, not imported
];

const options: depcheck.Options = {
  ignoreMatches: IGNORE_MATCHES,
  ignorePatterns: ['node_modules', 'coverage', 'dist', 'build', '.expo'],
};

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Dependency Declaration Validation');
  console.log('='.repeat(60));

  const result = await depcheck(repoRoot, options);
  const unusedDeps = result.dependencies;
  const unusedDevDeps = result.devDependencies;
  const missing = Object.keys(result.missing);

  const errors: string[] = [];

  if (unusedDeps.length > 0) {
    errors.push(`Unused dependencies: ${unusedDeps.join(', ')}`);
  }
  if (unusedDevDeps.length > 0) {
    errors.push(`Unused devDependencies: ${unusedDevDeps.join(', ')}`);
  }
  for (const name of missing) {
    const files = result.missing[name].map((f) => path.relative(repoRoot, f));
    errors.push(`Missing (used but not declared): ${name} (used in ${files.join(', ')})`);
  }

  if (errors.length === 0) {
    console.log('[PASS] No undeclared-but-used or declared-but-unused dependencies');
  } else {
    for (const error of errors) {
      console.log(`[FAIL] ${error}`);
    }
  }

  console.log('='.repeat(60));
  console.log(`Summary: ${errors.length} errors`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    process.exit(1);
  }
}

void main();
