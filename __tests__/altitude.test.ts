// Unit tests for altitude bias calculation

import {
  calculateAltitudeConfidence,
  calculateAltitudeBias,
  MIN_ALTITUDE_MULTIPLIER,
} from '../src/config/altitude';
import { AltitudeData } from '../src/types/gis';
import { AltitudePreference } from '../src/types/resources';

describe('calculateAltitudeConfidence', () => {
  it('returns 0 for null accuracy', () => {
    expect(calculateAltitudeConfidence(null)).toBe(0);
  });

  it('returns 0 for negative accuracy', () => {
    expect(calculateAltitudeConfidence(-10)).toBe(0);
  });

  it('returns 1.0 for excellent accuracy (<=10m)', () => {
    expect(calculateAltitudeConfidence(0)).toBe(1.0);
    expect(calculateAltitudeConfidence(5)).toBe(1.0);
    expect(calculateAltitudeConfidence(10)).toBe(1.0);
  });

  it('returns high confidence (0.8-1.0) for good accuracy (10-50m)', () => {
    const confidence20 = calculateAltitudeConfidence(20);
    expect(confidence20).toBeGreaterThan(0.8);
    expect(confidence20).toBeLessThan(1.0);

    const confidence50 = calculateAltitudeConfidence(50);
    expect(confidence50).toBeCloseTo(0.8, 5);
  });

  it('returns moderate confidence (0.4-0.8) for medium accuracy (50-150m)', () => {
    const confidence100 = calculateAltitudeConfidence(100);
    expect(confidence100).toBeGreaterThan(0.4);
    expect(confidence100).toBeLessThan(0.8);

    const confidence150 = calculateAltitudeConfidence(150);
    expect(confidence150).toBeCloseTo(0.4, 5);
  });

  it('returns low confidence (0-0.4) for poor accuracy (150-300m)', () => {
    const confidence200 = calculateAltitudeConfidence(200);
    expect(confidence200).toBeGreaterThan(0);
    expect(confidence200).toBeLessThan(0.4);

    const confidence300 = calculateAltitudeConfidence(300);
    expect(confidence300).toBeCloseTo(0, 5);
  });

  it('returns 0 for very poor accuracy (>300m)', () => {
    expect(calculateAltitudeConfidence(301)).toBe(0);
    expect(calculateAltitudeConfidence(500)).toBe(0);
    expect(calculateAltitudeConfidence(1000)).toBe(0);
  });
});

describe('calculateAltitudeBias', () => {
  const lowlandPreference: AltitudePreference = {
    optimal: [0, 500],
    viable: [0, 1000],
  };

  const montanePreference: AltitudePreference = {
    optimal: [1000, 2500],
    viable: [500, 3500],
  };

  const highConfidenceAltitude = (value: number): AltitudeData => ({
    value,
    accuracy: 5,
    confidence: 1.0,
  });

  const lowConfidenceAltitude = (value: number): AltitudeData => ({
    value,
    accuracy: 400,
    confidence: 0.1,
  });

  it('returns 1.0 when altitude data is undefined', () => {
    expect(calculateAltitudeBias(lowlandPreference, undefined)).toBe(1.0);
  });

  it('returns 1.0 when preference is undefined', () => {
    expect(calculateAltitudeBias(undefined, highConfidenceAltitude(100))).toBe(1.0);
  });

  it('returns 1.0 when confidence is below threshold', () => {
    expect(calculateAltitudeBias(lowlandPreference, lowConfidenceAltitude(2000))).toBe(1.0);
  });

  it('returns 1.0 for altitude within optimal range', () => {
    expect(calculateAltitudeBias(lowlandPreference, highConfidenceAltitude(0))).toBe(1.0);
    expect(calculateAltitudeBias(lowlandPreference, highConfidenceAltitude(250))).toBe(1.0);
    expect(calculateAltitudeBias(lowlandPreference, highConfidenceAltitude(500))).toBe(1.0);
  });

  it('returns MIN_ALTITUDE_MULTIPLIER for altitude outside viable range', () => {
    const bias = calculateAltitudeBias(lowlandPreference, highConfidenceAltitude(1500));
    expect(bias).toBeCloseTo(MIN_ALTITUDE_MULTIPLIER, 5);

    const biasBelow = calculateAltitudeBias(montanePreference, highConfidenceAltitude(100));
    expect(biasBelow).toBeCloseTo(MIN_ALTITUDE_MULTIPLIER, 5);
  });

  it('interpolates between optimal and viable boundaries', () => {
    // For lowland preference: optimal ends at 500, viable ends at 1000
    // At 750 (halfway), should be ~0.55 (midpoint between 1.0 and 0.1)
    const midBias = calculateAltitudeBias(lowlandPreference, highConfidenceAltitude(750));
    expect(midBias).toBeGreaterThan(MIN_ALTITUDE_MULTIPLIER);
    expect(midBias).toBeLessThan(1.0);
    expect(midBias).toBeCloseTo(0.55, 1);
  });

  it('interpolates below optimal range for montane species', () => {
    // For montane preference: optimal starts at 1000, viable starts at 500
    // At 750 (halfway below optimal), should interpolate
    const bias = calculateAltitudeBias(montanePreference, highConfidenceAltitude(750));
    expect(bias).toBeGreaterThan(MIN_ALTITUDE_MULTIPLIER);
    expect(bias).toBeLessThan(1.0);
  });

  it('blends bias with confidence for partial confidence values', () => {
    // Create an altitude with moderate confidence (0.6)
    const moderateConfidenceAltitude: AltitudeData = {
      value: 1500, // Outside viable range for lowland
      accuracy: 75,
      confidence: 0.6,
    };

    const bias = calculateAltitudeBias(lowlandPreference, moderateConfidenceAltitude);
    // With confidence 0.6, should blend between 1.0 and MIN_ALTITUDE_MULTIPLIER
    // Raw bias would be MIN_ALTITUDE_MULTIPLIER (0.1) for outside viable
    // Confidence factor = (0.6 - 0.2) / 0.8 = 0.5
    // Final = lerp(1.0, 0.1, 0.5) = 0.55
    expect(bias).toBeGreaterThan(MIN_ALTITUDE_MULTIPLIER);
    expect(bias).toBeLessThan(1.0);
  });

  it('ensures no species drops below 10% of base rate', () => {
    // Even at extreme altitudes with high confidence, minimum is enforced
    const extremeAltitude = highConfidenceAltitude(10000); // Way above any viable range
    const bias = calculateAltitudeBias(lowlandPreference, extremeAltitude);
    // Use approximate comparison due to floating point precision
    expect(bias).toBeCloseTo(MIN_ALTITUDE_MULTIPLIER, 5);
  });
});

describe('altitude bias edge cases', () => {
  it('handles coastal/mangrove species (0-50m range)', () => {
    const coastalPreference: AltitudePreference = {
      optimal: [0, 20],
      viable: [0, 50],
    };

    const highConfidence: AltitudeData = {
      value: 10,
      accuracy: 5,
      confidence: 1.0,
    };

    expect(calculateAltitudeBias(coastalPreference, highConfidence)).toBe(1.0);
  });

  it('handles high altitude species (3000m+)', () => {
    const alpinePreference: AltitudePreference = {
      optimal: [3000, 4000],
      viable: [2500, 4500],
    };

    const highConfidence: AltitudeData = {
      value: 3500,
      accuracy: 5,
      confidence: 1.0,
    };

    expect(calculateAltitudeBias(alpinePreference, highConfidence)).toBe(1.0);
  });
});
