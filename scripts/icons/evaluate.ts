// Evaluation Phase - Check icon quality using GPT-4o Vision
import * as fs from 'fs';
import * as path from 'path';
import { STATUS_FILE, OUTPUT_DIR, ASSETS_DIR, DALLE_CONFIG } from './lib/config';
import { StatusOutput, ResourceType, EvaluationCriteria, EvaluationOutput } from './lib/types';
import { createEvaluator } from './lib/generators';

// Parse command line arguments
function parseArgs(): {
  type?: ResourceType;
  id?: string;
  recheck: boolean; // Re-evaluate all icons including passed ones
  regen: boolean; // Mark failed icons for re-generation
  dryRun: boolean;
  limit?: number;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {
    recheck: false,
    regen: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      result.type = arg.split('=')[1] as ResourceType;
    } else if (arg.startsWith('--id=')) {
      result.id = arg.split('=')[1];
    } else if (arg === '--recheck') {
      result.recheck = true;
    } else if (arg === '--regen') {
      result.regen = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      result.limit = parseInt(arg.split('=')[1], 10);
    }
  }

  return result;
}

function loadStatus(): StatusOutput {
  if (fs.existsSync(STATUS_FILE)) {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  }
  return {
    updatedAt: new Date().toISOString(),
    summary: { total: 0, completed: 0, pending: 0, failed: 0 },
    resources: [],
  };
}

function saveStatus(status: StatusOutput): void {
  status.updatedAt = new Date().toISOString();
  status.summary = {
    total: status.resources.length,
    completed: status.resources.filter((r) => r.status === 'completed').length,
    pending: status.resources.filter((r) => r.status === 'pending').length,
    failed: status.resources.filter((r) => r.status === 'failed').length,
  };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function getIconPath(type: ResourceType, id: string): string {
  return path.join(ASSETS_DIR, `${type}s`, `${id}.png`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runEvaluate(): Promise<EvaluationOutput> {
  const args = parseArgs();

  console.log('Starting evaluation phase...');
  console.log(`  Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (args.type) console.log(`  Type filter: ${args.type}`);
  if (args.id) console.log(`  ID filter: ${args.id}`);
  if (args.recheck) console.log(`  Recheck mode: enabled (will re-evaluate passed icons)`);
  if (args.regen) console.log(`  Regen mode: enabled (will mark failed for re-generation)`);
  if (args.limit) console.log(`  Limit: ${args.limit}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load status
  const status = loadStatus();

  // Filter resources to evaluate
  // Only evaluate completed icons that haven't passed evaluation yet
  let toEvaluate = status.resources.filter((r) => {
    // Must be completed generation
    if (r.status !== 'completed') return false;

    // Skip already passed unless --recheck
    if (!args.recheck && r.evaluationStatus === 'passed') return false;

    return true;
  });

  // Apply type filter
  if (args.type) {
    toEvaluate = toEvaluate.filter((r) => r.type === args.type);
  }

  // Apply ID filter
  if (args.id) {
    toEvaluate = toEvaluate.filter((r) => r.id === args.id);
  }

  // Apply limit
  if (args.limit) {
    toEvaluate = toEvaluate.slice(0, args.limit);
  }

  console.log(`\nResources to evaluate: ${toEvaluate.length}`);

  const output: EvaluationOutput = { results: [] };

  if (toEvaluate.length === 0) {
    console.log('Nothing to evaluate.');
    return output;
  }

  if (args.dryRun) {
    console.log('\nDry run - would evaluate the following:');
    for (const r of toEvaluate) {
      console.log(`  ${r.type}/${r.id}: ${r.name}`);
    }
    return output;
  }

  // Create evaluator
  const evaluator = createEvaluator();
  console.log(`  Using evaluator: ${evaluator.name}`);

  // Evaluate images
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < toEvaluate.length; i++) {
    const r = toEvaluate[i];
    const progress = `[${i + 1}/${toEvaluate.length}]`;

    console.log(`\n${progress} Evaluating ${r.type}/${r.id}: ${r.name}`);

    const iconPath = getIconPath(r.type, r.id);

    // Check if icon exists
    if (!fs.existsSync(iconPath)) {
      console.log(`  Icon not found: ${iconPath}`);
      r.evaluationStatus = 'failed';
      r.evaluationIssues = ['Icon file not found'];
      saveStatus(status);
      output.results.push({
        id: r.id,
        passed: false,
        issues: ['Icon file not found'],
        confidence: 1.0,
      });
      failed++;
      continue;
    }

    r.evaluationStatus = 'evaluating';
    saveStatus(status);

    try {
      // Read image file
      const imageBuffer = fs.readFileSync(iconPath);

      // Build evaluation criteria
      const criteria: EvaluationCriteria = {
        type: r.type,
        name: r.name,
        checkForHands: r.type !== 'stone',
        checkForContainers: r.type === 'food',
        checkForLabels: true,
        checkForExtraItems: r.type !== 'stone',
        // Food-specific checks
        checkForExcessSeeds: r.type === 'food',
        checkForMissingSkin: r.type === 'food',
        // Stone-specific checks
        checkIsTexture: r.type === 'stone',
        checkFillsFrame: r.type === 'stone',
        checkNo3DObject: r.type === 'stone',
      };

      // Evaluate
      console.log(`  Calling vision API...`);
      const result = await evaluator.evaluate(imageBuffer, criteria);

      // Update status
      r.evaluationStatus = result.passed ? 'passed' : 'failed';
      r.evaluatedAt = new Date().toISOString();
      r.evaluationIssues = result.issues;
      saveStatus(status);

      // Track results
      output.results.push({
        id: r.id,
        passed: result.passed,
        issues: result.issues,
        confidence: result.confidence,
      });

      if (result.passed) {
        passed++;
        console.log(`  PASS (confidence: ${result.confidence.toFixed(2)})`);
      } else {
        failed++;
        console.log(`  FAIL (confidence: ${result.confidence.toFixed(2)})`);
        for (const issue of result.issues) {
          console.log(`    - ${issue}`);
        }

        // If --regen mode, mark the icon for re-generation
        if (args.regen) {
          console.log(`  Marking for re-generation...`);
          r.status = 'pending';
          r.evaluationStatus = undefined;
          saveStatus(status);
        }
      }

      // Rate limiting (vision API is cheaper but still rate-limited)
      if (i < toEvaluate.length - 1) {
        const waitTime = Math.ceil(60000 / DALLE_CONFIG.rateLimit);
        console.log(`  Waiting ${waitTime / 1000}s for rate limit...`);
        await sleep(waitTime);
      }
    } catch (e) {
      const error = e as Error;
      console.error(`  Error: ${error.message}`);
      r.evaluationStatus = 'failed';
      r.evaluationIssues = [`Evaluation error: ${error.message}`];
      saveStatus(status);
      output.results.push({
        id: r.id,
        passed: false,
        issues: [`Evaluation error: ${error.message}`],
        confidence: 0,
      });
      failed++;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n========================================');
  console.log('Evaluation complete!');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(
    `  Pass rate: ${toEvaluate.length > 0 ? Math.round((passed / toEvaluate.length) * 100) : 0}%`
  );
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Status file: ${STATUS_FILE}`);

  // Show summary of failures
  const failedResources = status.resources.filter(
    (r) => r.evaluationStatus === 'failed' && r.evaluationIssues && r.evaluationIssues.length > 0
  );
  if (failedResources.length > 0) {
    console.log('\nFailed evaluations:');
    for (const r of failedResources) {
      console.log(`  ${r.type}/${r.id} (${r.name}):`);
      for (const issue of r.evaluationIssues || []) {
        console.log(`    - ${issue}`);
      }
    }

    // Group failures by issue type
    const issueGroups = new Map<string, string[]>();
    for (const r of failedResources) {
      for (const issue of r.evaluationIssues || []) {
        const existing = issueGroups.get(issue) || [];
        existing.push(`${r.type}/${r.id}`);
        issueGroups.set(issue, existing);
      }
    }

    console.log('\nFailures by issue type:');
    const sortedIssues = [...issueGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [issue, resources] of sortedIssues) {
      console.log(`  "${issue}" (${resources.length}):`);
      for (const resource of resources) {
        console.log(`    - ${resource}`);
      }
    }

    if (!args.regen) {
      console.log('\nTip: Run with --regen to mark failed icons for re-generation');
    }
  }

  // Save evaluation report
  const reportPath = path.join(OUTPUT_DIR, 'evaluation-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: toEvaluate.length,
      passed,
      failed,
      passRate: toEvaluate.length > 0 ? Math.round((passed / toEvaluate.length) * 100) : 0,
    },
    results: output.results.map((r) => {
      const resource = status.resources.find((res) => res.id === r.id);
      return {
        ...r,
        type: resource?.type,
        name: resource?.name,
      };
    }),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  return output;
}

// Run if called directly
if (require.main === module) {
  runEvaluate().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}
