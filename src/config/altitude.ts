// Altitude Configuration - Bias calculation for altitude-based resource spawning
// Adjusts spawn rates based on GPS altitude data

import { AltitudeData } from '../types/gis';
import { AltitudePreference } from '../types/resources';

/**
 * Minimum multiplier to ensure no species drops below 10% of base spawn rate
 */
export const MIN_ALTITUDE_MULTIPLIER = 0.1;

/**
 * Confidence threshold below which altitude data is ignored
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.2;

/**
 * Calculate confidence score from GPS altitude accuracy
 * Maps accuracy (in meters) to a 0-1 confidence score
 *
 * Accuracy thresholds:
 * - <=10m: 1.0 (high confidence)
 * - 10-50m: 0.8-1.0 (good confidence)
 * - 50-150m: 0.4-0.8 (moderate confidence)
 * - 150-300m: 0.2-0.4 (low confidence)
 * - >300m: 0 (no confidence, data ignored)
 */
export function calculateAltitudeConfidence(accuracy: number | null): number {
  // No accuracy data means we can't trust the altitude
  if (accuracy === null || accuracy < 0) {
    return 0;
  }

  // Excellent accuracy (<=10m): full confidence
  if (accuracy <= 10) {
    return 1.0;
  }

  // Good accuracy (10-50m): high confidence
  if (accuracy <= 50) {
    return 0.8 + (0.2 * (50 - accuracy)) / 40;
  }

  // Moderate accuracy (50-150m): medium confidence
  if (accuracy <= 150) {
    return 0.4 + (0.4 * (150 - accuracy)) / 100;
  }

  // Low accuracy (150-300m): low confidence
  if (accuracy <= 300) {
    return (0.2 * (300 - accuracy)) / 150;
  }

  // Very poor accuracy (>300m): no confidence
  return 0;
}

/**
 * Linear interpolation helper
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Calculate the raw altitude bias for a resource based on current altitude
 * Returns a value between MIN_ALTITUDE_MULTIPLIER and 1.0
 *
 * Algorithm:
 * - Within optimal range: 1.0
 * - Outside viable range: MIN_ALTITUDE_MULTIPLIER
 * - Between optimal and viable: linear interpolation
 */
function calculateRawAltitudeBias(altitude: number, preference: AltitudePreference): number {
  const [optMin, optMax] = preference.optimal;
  const [viableMin, viableMax] = preference.viable;

  // Within optimal range: full spawn rate
  if (altitude >= optMin && altitude <= optMax) {
    return 1.0;
  }

  // Below viable minimum: minimum spawn rate
  if (altitude < viableMin) {
    return MIN_ALTITUDE_MULTIPLIER;
  }

  // Above viable maximum: minimum spawn rate
  if (altitude > viableMax) {
    return MIN_ALTITUDE_MULTIPLIER;
  }

  // Between viable minimum and optimal minimum: interpolate
  if (altitude < optMin) {
    const t = (altitude - viableMin) / (optMin - viableMin);
    return lerp(MIN_ALTITUDE_MULTIPLIER, 1.0, t);
  }

  // Between optimal maximum and viable maximum: interpolate
  const t = (viableMax - altitude) / (viableMax - optMax);
  return lerp(MIN_ALTITUDE_MULTIPLIER, 1.0, t);
}

/**
 * Calculate altitude bias multiplier for a resource
 *
 * Takes into account:
 * - The resource's altitude preference (optimal/viable ranges)
 * - The current altitude reading
 * - The confidence in the altitude data
 *
 * Returns a multiplier between MIN_ALTITUDE_MULTIPLIER (0.1) and 1.0
 * that should be applied to the resource's spawn weight.
 *
 * When confidence is low (<0.2), returns 1.0 (no bias applied).
 * When confidence is partial, blends between no bias and full bias.
 */
export function calculateAltitudeBias(
  preference: AltitudePreference | undefined,
  altitude: AltitudeData | undefined
): number {
  // No altitude data: no bias
  if (!altitude) {
    return 1.0;
  }

  // No altitude preference defined: no bias
  if (!preference) {
    return 1.0;
  }

  // Low confidence in altitude data: no bias
  if (altitude.confidence < MIN_CONFIDENCE_THRESHOLD) {
    return 1.0;
  }

  // Calculate raw bias based on altitude vs preference
  const rawBias = calculateRawAltitudeBias(altitude.value, preference);

  // Blend with confidence: higher confidence = more effect from altitude
  // At confidence 0.2 (threshold), this gives ~0% of the raw bias effect
  // At confidence 1.0, this gives 100% of the raw bias effect
  const confidenceFactor =
    (altitude.confidence - MIN_CONFIDENCE_THRESHOLD) / (1 - MIN_CONFIDENCE_THRESHOLD);
  return lerp(1.0, rawBias, confidenceFactor);
}
