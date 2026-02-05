// Sentry error tracking for WalkForage
// Provides crash reporting and error tracking in production

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Check if we're running in development
const IS_DEV = __DEV__;

// Get variant from Expo config
const APP_VARIANT = Constants.expoConfig?.extra?.eas?.appVariant ?? 'production';

/**
 * Initialize Sentry error tracking
 * Should be called as early as possible in app startup
 */
export function initSentry(): void {
  // Skip in development unless explicitly enabled
  if (IS_DEV) {
    console.log('Sentry: Skipping initialization in development mode');
    return;
  }

  // DSN should be configured via environment variable in production builds
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry: No DSN configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: APP_VARIANT,
    // Only send 10% of performance transactions in production to manage costs
    tracesSampleRate: APP_VARIANT === 'production' ? 0.1 : 1.0,
    // Adjust error sample rate if needed (default is 1.0 = 100%)
    // Don't send errors in development
    enabled: !IS_DEV,
    // Debug mode only in non-production
    debug: APP_VARIANT !== 'production',
  });
}

/**
 * Report an error to Sentry
 * @param error - The error to report
 * @param context - Optional additional context
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (IS_DEV) {
    console.error('Sentry.reportError (dev):', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Report a message to Sentry
 * @param message - The message to report
 * @param level - Severity level
 */
export function reportMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  if (IS_DEV) {
    console.log(`Sentry.reportMessage (dev) [${level}]:`, message);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error reports
 * @param userId - Optional user identifier
 */
export function setUserContext(userId?: string): void {
  if (IS_DEV) return;

  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add a breadcrumb for debugging
 * @param category - Category of the breadcrumb
 * @param message - Description
 * @param data - Optional additional data
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (IS_DEV) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

// Re-export Sentry for direct access when needed
export { Sentry };
