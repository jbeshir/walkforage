// Prompt Generation Phase - Create prompts from research data
import * as fs from 'fs';
import { RESEARCH_FILE, PROMPTS_FILE, OUTPUT_DIR } from './lib/config';
import { ResearchOutput, PromptsOutput } from './lib/types';
import { generatePrompt } from './lib/prompts';

export function runPrompts(): PromptsOutput {
  console.log('Starting prompt generation phase...');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load research data
  if (!fs.existsSync(RESEARCH_FILE)) {
    throw new Error(
      `Research file not found: ${RESEARCH_FILE}\nRun 'npm run icons:research' first.`
    );
  }

  const researchData: ResearchOutput = JSON.parse(fs.readFileSync(RESEARCH_FILE, 'utf-8'));

  console.log(`Generating prompts for ${researchData.resources.length} resources...`);

  const prompts = researchData.resources.map((resource) => ({
    id: resource.id,
    type: resource.type,
    name: resource.name,
    prompt: generatePrompt(resource),
  }));

  const output: PromptsOutput = {
    generatedAt: new Date().toISOString(),
    prompts,
  };

  // Write output
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify(output, null, 2));
  console.log(`Prompts generated. Output written to: ${PROMPTS_FILE}`);
  console.log(`  Total prompts: ${prompts.length}`);
  console.log(`  Stones: ${prompts.filter((p) => p.type === 'stone').length}`);
  console.log(`  Woods: ${prompts.filter((p) => p.type === 'wood').length}`);
  console.log(`  Foods: ${prompts.filter((p) => p.type === 'food').length}`);

  // Show sample prompts
  console.log('\nSample prompts:');
  const samples = [
    prompts.find((p) => p.type === 'stone'),
    prompts.find((p) => p.type === 'wood'),
    prompts.find((p) => p.type === 'food'),
  ].filter(Boolean);

  for (const sample of samples) {
    if (sample) {
      console.log(`\n[${sample.type}/${sample.id}]:`);
      console.log(`  ${sample.prompt.substring(0, 200)}...`);
    }
  }

  return output;
}

// Run if called directly
if (require.main === module) {
  runPrompts();
}
