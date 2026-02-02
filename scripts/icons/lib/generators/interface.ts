// Image Generator Interface
import { ResourceType, EvaluationCriteria, EvaluationResult } from '../types';

/**
 * Interface for image generation services.
 * Implementations should handle API calls and return the generated image URL.
 */
export interface ImageGenerator {
  /** Human-readable name of the generator */
  readonly name: string;

  /**
   * Generate an image from a prompt.
   * @param prompt The text prompt describing the image to generate
   * @returns URL of the generated image
   */
  generate(prompt: string): Promise<string>;

  /**
   * Check if this generator is suitable for a given resource type.
   * @param type The resource type (stone, wood, food)
   * @returns true if this generator works well for this type
   */
  supportsType(type: ResourceType): boolean;
}

/**
 * Interface for image evaluation services.
 * Used to check generated images for quality issues.
 */
export interface ImageEvaluator {
  /** Human-readable name of the evaluator */
  readonly name: string;

  /**
   * Evaluate an image against quality criteria.
   * @param imageBuffer The image data as a Buffer
   * @param criteria The evaluation criteria to check against
   * @returns Evaluation result with pass/fail and issues
   */
  evaluate(imageBuffer: Buffer, criteria: EvaluationCriteria): Promise<EvaluationResult>;
}
