// Step sync configuration: how much of Health Connect's history the step ledger reads.

/** Days of buckets re-read on every sync, so late watch or fitness-app data is still credited. */
export const RECONCILE_DAYS = 14;
/** Full local days before today credited by the first sync of a new game. */
export const WELCOME_DAYS = 7;
/** Health Connect shares only this many days before the app's first grant. */
export const HISTORY_WINDOW_DAYS = 30;
