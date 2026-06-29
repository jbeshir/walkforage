/**
 * Script Parity Validation
 *
 * Asserts that the quality gate steps are consistent across three sources of truth:
 * 1. package.json scripts.validate chain
 * 2. .github/workflows/ci.yml job steps
 * 3. CLAUDE.md Automated Validation table
 *
 * Run with: npx tsx src/scripts/validateScriptParity.ts
 */

import fs from 'fs';
import path from 'path';

// Steps intentionally present in ONE source but not the other.
// Keep this MINIMAL and documented. Empty today: CI mirrors `validate` exactly.
const CI_ONLY: readonly string[] = []; // steps in CI but deliberately not in `npm run validate`
const VALIDATE_ONLY: readonly string[] = []; // steps in `validate` but deliberately not in CI

const repoRoot = path.resolve(__dirname, '..', '..');

function parseValidateSteps(): string[] {
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
    scripts: Record<string, string>;
  };
  const validateScript = pkg.scripts['validate'] ?? '';
  const steps: string[] = [];
  for (const segment of validateScript.split('&&')) {
    const match = segment.trim().match(/^npm run ([\w:-]+)/);
    if (match) {
      steps.push(match[1]);
    }
  }
  return steps;
}

function parseCiSteps(): string[] {
  const ciPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
  const ciText = fs.readFileSync(ciPath, 'utf8');
  const steps: string[] = [];
  for (const line of ciText.split('\n')) {
    for (const m of line.matchAll(/npm run ([\w:-]+)/g)) {
      steps.push(m[1]);
    }
  }
  return steps;
}

function parseDocsSteps(): string[] {
  const docsPath = path.join(repoRoot, 'CLAUDE.md');
  const docsText = fs.readFileSync(docsPath, 'utf8');
  const steps: string[] = [];
  for (const line of docsText.split('\n')) {
    if (line.trim().startsWith('|')) {
      const m = line.match(/`npm run ([\w:-]+)`/);
      if (m) {
        steps.push(m[1]);
      }
    }
  }
  return steps;
}

function listsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function describeDiff(expected: string[], actual: string[]): string[] {
  const lines: string[] = [];
  const missing = expected.filter((s) => !actual.includes(s));
  const extra = actual.filter((s) => !expected.includes(s));
  lines.push(`  expected: [${expected.join(', ')}]`);
  lines.push(`  actual:   [${actual.join(', ')}]`);
  if (missing.length > 0) lines.push(`  missing:  [${missing.join(', ')}]`);
  if (extra.length > 0) lines.push(`  extra:    [${extra.join(', ')}]`);
  if (missing.length === 0 && extra.length === 0) {
    lines.push('  (same set, order differs)');
  }
  return lines;
}

function checkScriptParity(): string[] {
  const errors: string[] = [];

  const validateSteps = parseValidateSteps();
  const ciSteps = parseCiSteps();
  const docsSteps = parseDocsSteps();

  // Guard: validate chain must be non-empty (catches parse failures)
  if (validateSteps.length === 0) {
    console.log('[FAIL] package.json validate chain parsed 0 steps — possible parse failure');
    errors.push('package.json validate chain is empty — check scripts.validate format');
  } else {
    console.log(`[PASS] package.json validate chain: ${validateSteps.length} steps`);
  }

  // Check 1: CI vs validate chain (applying allowlists)
  const expectedCi = validateSteps.filter((s) => !VALIDATE_ONLY.includes(s));
  const actualCiCore = ciSteps.filter((s) => !CI_ONLY.includes(s));
  if (!listsEqual(actualCiCore, expectedCi)) {
    console.log('[FAIL] CI steps do not match validate chain');
    for (const line of describeDiff(expectedCi, actualCiCore)) {
      console.log(line);
    }
    errors.push('CI steps differ from validate chain');
  } else {
    console.log(`[PASS] CI steps match validate chain (${ciSteps.length} steps)`);
  }

  // Check 2: docs vs validate chain
  if (docsSteps.length === 0) {
    console.log('[FAIL] CLAUDE.md table parsed 0 steps — table missing or parse failure');
    errors.push('CLAUDE.md Automated Validation table is empty or not found');
  } else if (!listsEqual(docsSteps, validateSteps)) {
    console.log('[FAIL] CLAUDE.md docs steps do not match validate chain');
    for (const line of describeDiff(validateSteps, docsSteps)) {
      console.log(line);
    }
    errors.push('CLAUDE.md docs steps differ from validate chain');
  } else {
    console.log(`[PASS] CLAUDE.md docs steps match validate chain (${docsSteps.length} steps)`);
  }

  return errors;
}

function main(): void {
  console.log('='.repeat(60));
  console.log('Script Parity Validation');
  console.log('='.repeat(60));

  const errors = checkScriptParity();

  console.log('='.repeat(60));
  console.log(`Summary: ${errors.length} errors`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    process.exit(1);
  }
}

export { checkScriptParity };

main();
