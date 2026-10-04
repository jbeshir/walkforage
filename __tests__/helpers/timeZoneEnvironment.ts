// Jest environment that lets a test change the process time zone.
// Jest gives each test file a copy of process.env, so assigning process.env.TZ in a test does not
// reach Node, and local-time Date methods keep the old zone. This environment runs outside the test
// sandbox and exposes `setTimeZone`, which sets the real process.env.TZ (Node re-reads it on every
// assignment). The original zone is restored when the test file finishes.
//
// Usage: start the test file with the docblock
//   /** @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts */
// and call `setTimeZone('Europe/London')` from './helpers/timeZone'.

import { TestEnvironment } from 'jest-environment-jsdom';

export default class TimeZoneEnvironment extends TestEnvironment {
  private readonly originalTimeZone = process.env.TZ;

  constructor(...args: ConstructorParameters<typeof TestEnvironment>) {
    super(...args);
    this.global.setTimeZone = (timeZone: string) => {
      process.env.TZ = timeZone;
    };
  }

  async teardown(): Promise<void> {
    if (this.originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = this.originalTimeZone;
    await super.teardown();
  }
}
