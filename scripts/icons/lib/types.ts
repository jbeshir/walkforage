// Icon Generation Pipeline Types

export type ResourceType = 'stone' | 'wood' | 'food';
export type GeneratorName = 'dalle' | 'replicate' | 'gpt-image';

export interface AppearanceData {
  primaryColors: string[];
  secondaryColors?: string[];
  texture: string;
  pattern?: string;
  distinguishingFeatures: string[];
  familyFeatures?: string[]; // General features common to tree family (oaks, pines, etc.)
  trunkColor?: string; // Explicit trunk/bark color for trees
  foliageColor?: string; // Explicit leaf/needle color for trees
}

export interface ResourceResearch {
  id: string;
  type: ResourceType;
  name: string;
  scientificName?: string;
  category: string;
  appearance: AppearanceData;
  prompt?: string;
}

export interface ResearchOutput {
  generatedAt: string;
  resources: ResourceResearch[];
  missing: { id: string; type: ResourceType; name: string }[];
}

export interface PromptsOutput {
  generatedAt: string;
  prompts: {
    id: string;
    type: ResourceType;
    name: string;
    prompt: string;
  }[];
}

export interface GenerationStatus {
  id: string;
  type: ResourceType;
  name: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  generatedAt?: string;

  // Evaluation tracking
  evaluationStatus?: 'pending' | 'evaluating' | 'passed' | 'failed';
  evaluatedAt?: string;
  evaluationIssues?: string[];
}

export interface EvaluationCriteria {
  type: ResourceType;
  name: string;
  checkForHands: boolean;
  checkForContainers: boolean;
  checkForLabels: boolean;
  checkForExtraItems: boolean;
  // Food-specific checks
  checkForExcessSeeds: boolean;
  checkForMissingSkin: boolean;
  // Stone-specific checks
  checkIsTexture: boolean;
  checkFillsFrame: boolean;
  checkNo3DObject: boolean;
}

export interface EvaluationResult {
  passed: boolean;
  issues: string[];
  confidence: number; // 0-1
}

export interface StatusOutput {
  updatedAt: string;
  summary: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
  };
  resources: GenerationStatus[];
}

export interface EvaluationOutput {
  results: Array<{
    id: string;
    passed: boolean;
    issues: string[];
    confidence: number;
  }>;
}

// Appearance data files structure
export type AppearanceDataFile = Record<string, AppearanceData>;
