// Sets the process time zone from a test running in ./timeZoneEnvironment.ts (see there).

export function setTimeZone(timeZone: string): void {
  const { setTimeZone: set } = globalThis as unknown as { setTimeZone?: (tz: string) => void };
  if (!set)
    throw new Error(
      'setTimeZone needs @jest-environment ./__tests__/helpers/timeZoneEnvironment.ts'
    );
  set(timeZone);
}
