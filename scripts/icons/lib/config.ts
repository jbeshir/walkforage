// Icon Generation Pipeline Configuration
import * as path from 'path';

// Project paths
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
export const SCRIPTS_DIR = path.resolve(PROJECT_ROOT, 'scripts', 'icons');
export const OUTPUT_DIR = path.resolve(SCRIPTS_DIR, 'output');
export const APPEARANCES_DIR = path.resolve(SCRIPTS_DIR, 'appearances');
export const ASSETS_DIR = path.resolve(PROJECT_ROOT, 'assets', 'icons');
export const SRC_DIR = path.resolve(PROJECT_ROOT, 'src');

// Output files
export const RESEARCH_FILE = path.resolve(OUTPUT_DIR, 'research.json');
export const PROMPTS_FILE = path.resolve(OUTPUT_DIR, 'prompts.json');
export const STATUS_FILE = path.resolve(OUTPUT_DIR, 'status.json');

// Appearance data files
export const STONES_APPEARANCES = path.resolve(APPEARANCES_DIR, 'stones.json');
export const WOODS_APPEARANCES = path.resolve(APPEARANCES_DIR, 'woods.json');
export const FOODS_APPEARANCES = path.resolve(APPEARANCES_DIR, 'foods.json');

// DALL-E API configuration
export const DALLE_CONFIG = {
  model: 'dall-e-3' as const,
  size: '1024x1024' as const,
  quality: 'standard' as const, // 'standard' ($0.04) or 'hd' ($0.08)
  style: 'natural' as const, // 'natural' for realistic colors
  rateLimit: 5, // requests per minute (tier dependent)
  retryDelay: 60000, // 1 minute for rate limit retries
  maxRetries: 3,
};

// GPT Image API configuration (better instruction following than DALL-E)
export const GPT_IMAGE_CONFIG = {
  model: 'gpt-image-1.5' as const,
  size: '1024x1024' as const,
  quality: 'high' as const, // 'low', 'medium', 'high'
  outputFormat: 'png' as const,
  rateLimit: 5,
  retryDelay: 60000,
  maxRetries: 3,
};

// GPT-4o Vision API configuration (for evaluation)
export const VISION_CONFIG = {
  model: 'gpt-4o' as const,
  maxTokens: 1000,
  temperature: 0, // Deterministic for consistent evaluation
};

// Replicate Material Stable Diffusion configuration
export const REPLICATE_CONFIG = {
  model: 'tommoore515/material_stable_diffusion',
  version: 'a42692c54c0f407f803a0a8a9066160976baedb77c91171a01730f9b0d7beeff',
  parameters: {
    guidance_scale: 7.5,
    num_inference_steps: 50,
    width: 512,
    height: 512,
  },
  pollInterval: 1000, // 1 second polling interval
  maxPollTime: 120000, // 2 minute timeout
};

// Image specifications
export const IMAGE_SPECS = {
  generationSize: 1024, // Generate at high res
  outputSize: 120, // 40pt * 3x for retina
  format: 'png' as const,
};

// Style keywords for prompts
export const STYLE_KEYWORDS = [
  'game icon style',
  'bright vibrant colors',
  'clean edges',
  'recognizable',
  'slightly stylized but realistic',
  'centered composition',
  'simple natural background',
  'square format',
  'no text or labels',
];

// Get OpenAI API key from environment
export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. Set it before running icon generation.'
    );
  }
  return key;
}

// Get Replicate API token from environment
export function getReplicateApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      'REPLICATE_API_TOKEN environment variable is required. Set it before running icon generation with Replicate.'
    );
  }
  return token;
}
