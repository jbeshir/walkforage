// Icon Generation Pipeline - Main CLI Entry Point
// Usage: npx tsx scripts/icons/index.ts <command> [options]

import { runResearch } from './research';
import { runPrompts } from './prompts';
import { runGenerate } from './generate';
import { runResize } from './resize';
import { runEvaluate } from './evaluate';
import { runIntegrate } from './integrate';
import { runValidation } from './validate';
import * as fs from 'fs';
import { STATUS_FILE } from './lib/config';

const COMMANDS = {
  research: {
    description: 'Load resources and merge with appearance data',
    run: () => runResearch(),
  },
  prompts: {
    description: 'Generate prompts from research data',
    run: () => runPrompts(),
  },
  generate: {
    description: 'Generate icons using AI image generators',
    run: () => runGenerate(),
  },
  resize: {
    description: 'Resize source icons (1024px) to bundled size (120px)',
    run: () => runResize(),
  },
  evaluate: {
    description: 'Evaluate icons with vision model',
    run: () => runEvaluate(),
  },
  integrate: {
    description: 'Generate icon loader utility',
    run: () => runIntegrate(),
  },
  validate: {
    description: 'Validate icon coverage',
    run: () => runValidation(),
  },
  status: {
    description: 'Show current generation status',
    run: () => showStatus(),
  },
  all: {
    description: 'Run full pipeline (research -> prompts -> generate -> evaluate -> integrate)',
    run: () => runAll(),
  },
  help: {
    description: 'Show this help message',
    run: () => showHelp(),
  },
};

function showHelp(): void {
  console.log('Icon Generation Pipeline');
  console.log('========================\n');
  console.log('Usage: npx tsx scripts/icons/index.ts <command> [options]\n');
  console.log('Commands:');
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${cmd.description}`);
  }
  console.log('\nGenerate options:');
  console.log('  --type=<stone|wood|food>  Filter by resource type');
  console.log('  --id=<resource_id>        Generate single resource');
  console.log('  --force                   Regenerate existing icons');
  console.log('  --dry-run                 Preview without API calls');
  console.log('  --limit=<n>               Limit number to generate');
  console.log('  --service=<dalle|replicate|gpt-image>  Force specific generator');
  console.log('\nEvaluate options:');
  console.log('  --type=<stone|wood|food>  Filter by resource type');
  console.log('  --id=<resource_id>        Evaluate single resource');
  console.log('  --recheck                 Re-evaluate passed icons');
  console.log('  --regen                   Mark failed icons for re-generation');
  console.log('  --dry-run                 Preview without API calls');
  console.log('  --limit=<n>               Limit number to evaluate');
  console.log('\nGenerator selection:');
  console.log('  - Stones: Replicate Material SD (flat textures)');
  console.log('  - Woods/Foods: GPT Image (better instruction following)');
  console.log('  Use --service to override the default for a type.');
  console.log('\nExample workflow:');
  console.log('  1. npm run icons:research   # Merge appearance data');
  console.log('  2. npm run icons:prompts    # Generate prompts');
  console.log('  3. npm run icons:generate   # Generate icons (1024px to icons-source/)');
  console.log('  4. npm run icons:resize     # Resize to 120px in icons/');
  console.log('  5. npm run icons:evaluate   # Check quality with vision');
  console.log('  6. npm run icons:integrate  # Update loader');
  console.log('  7. npm run validate:icons   # Validate coverage');
}

interface StatusResource {
  id: string;
  type: string;
  status: string;
  error?: string;
  evaluationStatus?: string;
  evaluationIssues?: string[];
}

function showStatus(): void {
  if (!fs.existsSync(STATUS_FILE)) {
    console.log('No status file found. Run generation first.');
    return;
  }

  const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  console.log('Icon Generation Status');
  console.log('======================');
  console.log(`Last updated: ${status.updatedAt}\n`);
  console.log('Generation Summary:');
  console.log(`  Total:     ${status.summary.total}`);
  console.log(`  Completed: ${status.summary.completed}`);
  console.log(`  Pending:   ${status.summary.pending}`);
  console.log(`  Failed:    ${status.summary.failed}`);

  // Show by type
  const byType: Record<string, { completed: number; failed: number; pending: number }> = {};
  for (const resource of status.resources as StatusResource[]) {
    if (!byType[resource.type]) {
      byType[resource.type] = { completed: 0, failed: 0, pending: 0 };
    }
    byType[resource.type][resource.status as 'completed' | 'failed' | 'pending']++;
  }

  console.log('\nBy type:');
  for (const [type, counts] of Object.entries(byType)) {
    console.log(
      `  ${type}: ${counts.completed} done, ${counts.pending} pending, ${counts.failed} failed`
    );
  }

  // Evaluation summary
  const evalStats = {
    passed: 0,
    failed: 0,
    pending: 0,
  };
  for (const r of status.resources as StatusResource[]) {
    if (r.evaluationStatus) {
      if (r.evaluationStatus === 'passed') evalStats.passed++;
      else if (r.evaluationStatus === 'failed') evalStats.failed++;
      else evalStats.pending++;
    }
  }
  if (evalStats.passed + evalStats.failed + evalStats.pending > 0) {
    console.log('\nEvaluation Summary:');
    console.log(`  Passed:  ${evalStats.passed}`);
    console.log(`  Failed:  ${evalStats.failed}`);
    console.log(`  Pending: ${evalStats.pending}`);
  }

  // Show failed generation resources
  const failedGen = (status.resources as StatusResource[]).filter((r) => r.status === 'failed');
  if (failedGen.length > 0) {
    console.log('\nFailed generation:');
    for (const r of failedGen) {
      console.log(`  - ${r.type}/${r.id}: ${r.error || 'Unknown error'}`);
    }
  }

  // Show failed evaluation resources
  const failedEval = (status.resources as StatusResource[]).filter(
    (r) => r.evaluationStatus === 'failed'
  );
  if (failedEval.length > 0) {
    console.log('\nFailed evaluation:');
    for (const r of failedEval) {
      console.log(`  - ${r.type}/${r.id}: ${r.evaluationIssues?.join(', ') || 'Unknown issues'}`);
    }
  }
}

async function runAll(): Promise<void> {
  console.log('Running full icon generation pipeline...\n');
  console.log('========================================');

  console.log('\n[1/7] Research phase');
  console.log('--------------------');
  runResearch();

  console.log('\n[2/7] Prompts phase');
  console.log('-------------------');
  runPrompts();

  console.log('\n[3/7] Generation phase');
  console.log('----------------------');
  await runGenerate();

  console.log('\n[4/7] Resize phase');
  console.log('------------------');
  await runResize();

  console.log('\n[5/7] Evaluation phase');
  console.log('----------------------');
  const evalResult = await runEvaluate();

  // Check if any evaluations failed
  const failedCount = evalResult.results.filter((r) => !r.passed).length;
  if (failedCount > 0) {
    console.log(`\n[5b/7] ${failedCount} icons failed evaluation`);
    console.log(
      '  Run "npm run icons:evaluate -- --retry" to mark failed icons for re-generation,'
    );
    console.log('  then re-run the pipeline to regenerate them.');
  }

  console.log('\n[6/7] Integration phase');
  console.log('-----------------------');
  runIntegrate();

  console.log('\n[7/7] Validation phase');
  console.log('----------------------');
  runValidation();

  console.log('\n========================================');
  console.log('Pipeline complete!');
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';

  if (!(command in COMMANDS)) {
    console.error(`Unknown command: ${command}`);
    console.error('Run with "help" to see available commands.');
    process.exit(1);
  }

  try {
    const result = COMMANDS[command as keyof typeof COMMANDS].run();
    if (result instanceof Promise) {
      await result;
    }
  } catch (e) {
    console.error('Error:', (e as Error).message);
    process.exit(1);
  }
}

main();
