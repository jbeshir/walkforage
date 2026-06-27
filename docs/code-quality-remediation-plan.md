# WalkForage — Code-Quality Remediation Plan

Staged plan to implement every fix from the 12-lens defect survey (2026-06-27).
Survey headline: **0 critical, 0 high, top severity medium**; 36 confirmed + 21
suspected findings, concentrated in three regions (step-sync async, game-state
persistence, `HealthService` tests). This is a hardening pass on an already-clean
codebase, not a rescue.

## Principles

- **Each stage ends green** on `npm run validate` (typecheck → lint → format →
  test → domain validators → doctor → deps:check).
- **Stages are ordered by leverage** and so that behaviour-affecting correctness
  fixes land before cosmetic cleanup. Stage 6 (test hardening) should land
  **before or alongside** Stage 5 (render refactor) so the refactor is protected —
  the two touch different surfaces (services/hooks vs screens), so they don't
  conflict.
- **Behaviour-preserving** everywhere except the explicitly-noted async/persistence
  semantics changes (Stages 1–2), which fix latent failure modes.
- **Decision points** (🔶) need a product call before implementing; they are
  isolated so the rest of a stage can proceed without them.

---

## Stage 1 — Async / concurrency correctness

The most actionable correctness gap. Fire-and-forget promises and empty catches
around the step/gathering loop hide failures rather than crash.

1. **Tame the three floating `doSyncSteps()` calls** —
   `src/hooks/useStepGathering.ts:106` (init effect), `:124` (auto-sync interval),
   `:194` (post-permission-grant). Minimum: `void doSyncSteps();` to mark intent.
   Better: `.then(r => { if (!r.success) console.warn('step sync failed:', r.error); })`
   so a persistently-failing auto-sync is observable instead of silently looping.
   *(lens 03 #1–3)*
2. **`ForageScreen` geo-data fetch** — `src/screens/ForageScreen.tsx:101-111`. Add
   a cancellation guard and depend on primitive coords so it doesn't re-fire on
   every GPS jitter and a slow earlier response can't clobber a newer one:
   ```ts
   useEffect(() => {
     let cancelled = false;
     if (location && geoDataService) {
       geoDataService.getLocationData(location.latitude, location.longitude, {...})
         .then(d => { if (!cancelled) setGeoData(d); })
         .catch(err => console.warn('Failed to get geo data:', err));
     }
     return () => { cancelled = true; };
   }, [location?.latitude, location?.longitude, geoDataService]);
   ```
   *(lens 02 #1, lens 01 #4)*
3. **`NodeTileLoader` empty catches** — `src/services/NodeTileLoader.ts:54`, `:73`.
   Add a log binding mirroring `ExpoTileLoader` so a DB/schema error is
   distinguishable from a genuine cache miss:
   `catch (error) { console.warn('NodeTileLoader query failed:', error); return null/[]; }`
   *(lens 03 #4–5)*
4. **Capture `openHealthSettings()`/`openPlayStore()` return** —
   `src/components/StepGatherPanel.tsx:104,116`. Toast on `false` so a failed
   deep-link gives feedback instead of a dead button. *(lens 03 #6, suspected)*
5. **Regression guard (decided: enable type-aware lint):** enable
   `@typescript-eslint/no-floating-promises` in `eslint.config.js`, wiring up
   type-aware linting (`parserOptions.projectService` + `tsconfigRootDir`) since
   the rule requires it. Triage any pre-existing floats it surfaces as part of this
   stage. This is the durable guard against the whole fire-and-forget class.

**Validate.** Watch for new lint errors from the type-aware config.

---

## Stage 2 — Game-state persistence integrity

Single autosave key with three unsequenced writers; no schema version; no numeric
backstop on load. Correct in the common case today, fragile under change.

1. **Serialize saves behind one write queue** — `src/hooks/useGameState.ts`.
   Collapse `saveGame` (closes over `state`) and `saveGameImmediate` (reads
   `stateRef.current`) into a single path that always reads `stateRef.current`, and
   chain writes so only one `setItem` is ever in flight:
   `savePromise = savePromise.then(doWrite)`. Keep the 30s timer and AppState
   trigger, but route both through the same queue. Removes the lost-update window
   where a stale `state` snapshot overwrites a fresher one. *(lens 04 #1)*
2. **Add `schemaVersion` + migration chain** — stamp `{ schemaVersion: N, ... }`
   into the persisted object; in `loadGame` run an ordered migration chain before
   the `{ ...INITIAL_STATE, ...parsed }` merge so future field-shape changes are
   upgradable instead of silently stale. *(lens 04 #2)*
3. **Validate/coerce restored shapes and numerics on load** —
   `src/hooks/useGameState.ts:132-152`. Guard `Array.isArray(parsed.ownedTools)`
   etc., validate inventory stack elements (not just that the per-type array
   exists), and sanitise numeric fields:
   `Number.isFinite(x) ? Math.max(0, Math.floor(x)) : default` for
   `availableSteps`/`totalStepsGathered`/`explorationPoints`/stack `quantity`.
   This is a self-healing backstop against corrupt/tampered/migrated stores and
   closes the sticky-NaN trap (`NaN += newSteps` stays `NaN` forever). *(lens 04 #3,
   lens 05 #2)*
4. **Surface persistent save failure** — on repeated `setItem` rejection set an
   error flag the UI can show ("progress not being saved") rather than only
   `console.error` into the void (AsyncStorage size/device-full errors otherwise
   lose all progress silently on next launch). *(lens 04 #4, suspected)*
5. **Guard concurrent DB init** — `ExpoTileLoader.initDatabase`: cache the in-flight
   promise (`this.initPromise ??= openDatabaseAsync(...)`) so two near-simultaneous
   first `getTile` calls share one open. Harmless today (read-only) but cheap.
   *(lens 04 #5)*

**Validate.** Add/extend `useGameState` tests: schema migration path, corrupt-store
fallback, NaN sanitisation, write-queue ordering.

---

## Stage 3 — Native-boundary numeric/null hardening

Data crossing the HealthKit/HealthConnect boundary is trusted by shape. All latent
(caught or unreachable today), one fix family: coerce at the boundary.

1. **Android `getStepsSince` symmetry** — `src/services/HealthService.ts:204`. Add
   the `Math.floor` its iOS sibling (`:220`) already applies. *(lens 05 #1)*
2. **Defend the native step-aggregation shape** —
   `src/services/HealthService.ts:203,219`. Coerce defensively so a malformed/`NaN`
   native payload becomes a clean `0` rather than a `NaN` step credit:
   `(result?.records ?? []).reduce((s, r) => s + (Number(r?.count) || 0), 0)` and the
   analogous HealthKit `(samples ?? []).reduce((s, x) => s + (Number(x?.quantity) || 0), 0)`.
   *(lens 06 suspected #1–2)*
3. **(Optional) NaN clamp on craftable quality** —
   `src/utils/qualityCalculation.ts`: `const q = totalScore/materialCount; return Number.isFinite(q) ? Math.min(1, Math.max(0, q)) : 0.1;`
   Only matters if data ever introduces NaN; defensive. *(lens 05 #3)*

**Validate.** Covered by the strengthened `HealthService` tests in Stage 6.

---

## Stage 4 — Hook dependency hygiene & clarity

No live bugs — the disables are "safe by coincidence". The risk is the inaccurate
justifying comments masking future regressions.

1. **`useGameState` context-value memo** — `src/hooks/useGameState.ts:437-464`. The
   line-437 comment "Callbacks are stable" is **factually wrong** (several callbacks
   depend on `state` slices). Either (a) make the helpers truly stable by routing
   all reads through `stateRef.current` (the pattern `getStepGatheringState` already
   uses) and keep `[state, isLoading]`, or (b) add the changing callbacks to the dep
   array and drop the disable. At minimum, correct the comment. *(lens 01 #1)*
2. **Document the `useStepGathering` eslint-disable contract** — `:105`, `:124`.
   Replace each bare `// eslint-disable-next-line` with a one-line note: *why* it's
   safe ("`doSyncSteps` reads live state via `getStepGatheringState()`/
   `healthService`, so a stale closure can't read stale step data"). Optionally hoist
   `doSyncSteps` into a ref and call `syncRef.current()` to make the safety
   structural rather than incidental. *(lens 01 #2–3)*

**Validate.**

---

## Stage 5 — Render-path performance (pre-empt the scaling cliff)

Harmless at current data sizes (≤66 rows) but uniformly missing virtualization and
memoization. **Leave the map overlay path alone** — `GeohashOverlay`/`MapLegend` are
already correctly `useMemo`'d; do not "fix" them.

1. **`CheatScreen` material tabs (highest payoff)** —
   `src/screens/CheatScreen.tsx:125-172`. Renders all 66 woods / 55 foods + images +
   3 inline-arrow handlers per row into a `ScrollView`. Convert to `FlatList` with
   `keyExtractor`; hoist the `+1/+10/+100` handlers into a memoized row component
   taking `(materialType, resourceId)`. *(lens 07 #1)*
2. **`CraftingScreen`** — `src/screens/CraftingScreen.tsx`. Wrap `OwnedToolItem`,
   `OwnedComponentItem`, `ToolRecipeItem`, `ComponentRecipeItem` in `React.memo`;
   `useMemo` the derived `availableTools`/`availableComponents` (`:379-380`) and the
   `groupToolsByType` result (`:398-421`) keyed on `ownedTools`/`unlockedTechs`;
   replace inline `onCraft={() => handleCraft(...)}` (`:561,589`) with stable
   handlers. *(lens 07 #2)*
3. **`InventoryScreen`** — `:108-114` `useMemo` `materialTotals`; wrap `ResourceItem`
   (`:19`) in `React.memo`. *(lens 07 #3)*
4. **`StepGatherPanel`** — `:72-80` `useMemo` `materialGatheringInfo` keyed on
   `[availableSteps, state.ownedTools]` (component re-renders every step tick).
   *(lens 07 #5)*
5. **`TechTreeScreen` (low)** — `:174-200` memoize `TechNode`; precompute an
   `availableTechIds` `Set` to drop the per-node `.some()`. Trivial (7 techs).
   *(lens 07 #4)*
6. **Resolve suspected #8** — read `src/utils/icons`; if `getResourceIcon` rebuilds a
   map per call, memoize it (compounds the CheatScreen cost). *(lens 07 #8)*
7. **Direction, not just fixes:** adopt `FlatList` as the default for any list that
   can grow (Inventory stacks, Cheat grids); add `getItemLayout` where row height is
   fixed. *(lens 07 #7)*

**Validate.** Manual smoke of each screen; `@testing-library/react-native` render
tests if cheap.

---

## Stage 6 — Test-suite hardening

Test confidence is weakest exactly where the residual defects live (`HealthService`).
**Do this before/with Stage 5.**

1. **Make `HealthService` testable (highest value)** —
   `src/services/HealthService.test.ts`. The singleton (`HealthService.ts:337`)
   forces `expect([...all statuses]).toContain(x)` and `typeof === 'number'`
   tautologies. Export the **class** (allow `new HealthService()`) or add a
   `__resetForTests()` hook, then assert exact outcomes: `getStepsSince` returns
   `350` for `[{count:100},{count:200},{count:50}]` (and `Math.floor` of the iOS
   sample sum — locks in Stage 3 #1–2); `checkPermission` returns exactly
   `'authorized'` vs `'not_determined'`. *(lens 11 #1)*
2. **De-vacuum guarded GIS assertions** — seed the Node test DB / `NodeTileLoader`
   so realm/ecoregion data is present, then drop the `if (data.biome.realm)` guards
   in `GeoDataService.test.ts:114-153,225-227` and assert unconditionally. In
   `ResourceSpawnService.test.ts:158-215`, replace "all ids exist in `WOODS_BY_ID`"
   (tautological) with a real preference assertion (majority of N draws match the
   biome/realm), mirroring the good chalk→flint test at `:105-116`. *(lens 11 #2)*
3. **Replace type-literal tautologies** — `toolTypes.test.ts:15-45,47-100,102-107`
   assert array-literal lengths / re-read just-written object fields (testing
   TypeScript, not code). Delete; enforce union exhaustiveness with a compile-time
   `satisfies`/never-check if it matters. Keep the genuinely-good `getQualityTier`/
   `calculateGatheringBonus` tests. *(lens 11 #3)*
4. **Harden conditional self-skips** — `CraftingService.test.ts:132-135,163-166,
   359-383,434-438` and the `if (gatheringToolWithBonus)` guards
   (`toolTypes.test.ts:151-205`) silently pass when preconditions aren't met. Turn
   each silent `return`/skip into an explicit precondition assertion
   (`expect(canCraft).toBe(true)` / `expect(tool).toBeDefined()`) so a data
   regression fails loudly. *(lens 11 #4)*
5. **Trim trivial shape/export tests** —
   `useStepGathering.test.ts:495-518`, `TechService.test.ts:355-372`,
   `foods.test.ts:30-34`: convert to a single TS-level check or remove. *(lens 11 #5)*
6. **Soften magic-count brittleness** — `stones`/`techTree`/`foods`/`woods` exact
   `.length).toBe(N)`: keep a lower-bound sanity check or derive the count from the
   source of truth instead of a hand-maintained literal. *(lens 11 #6)*
7. **Move inline formula tests into source** — `useGameState.test.ts:410-438`
   re-implements durability/degradation math in-test; import the function from `src/`
   and test *that*. *(lens 11 #7)*

**Validate.** `npm run test:coverage` — confirm `HealthService`/spawn coverage rises.

---

## Stage 7 — Dead code, dependencies, docs (low-risk housekeeping)

All static, no behaviour change. Batch into one PR.

### Dead / disconnected code *(lens 10)*
1. **Delete confirmed-dead exports:** `getUsedMaterialQuantity`,
   `createUsedMaterials` (`src/types/tools.ts:58,66`); `GeologicalZone`
   (`src/types/resources.ts:122`); `getMaterialPluralName`,
   `getMaterialSingularName` (`src/config/materials.ts:182,186`). Re-run `tsc`.
2. **Delete the two dead barrels** (decided) — `src/data/index.ts` and
   `src/hooks/index.ts` are unimported and incomplete; remove both. Every consumer
   already imports the concrete module directly, so no import migration is needed.
   Re-run `tsc`.
3. **Collapse inline `id.replace(/_/g, ' ')`** — `CraftingScreen.tsx:201,208,288`.
   Introduce/reuse a single non-capitalising `humanizeId` helper (a `formatSnakeCase`
   already exists in `src/utils/strings.ts`); verify display output first (the inline
   version doesn't capitalise). *(lens 10 #8)*
4. **Fix stale comment** — `src/utils/geoFallbacks.ts:5` says "node-gis-loader"; the
   file is `NodeTileLoader.ts`.

### Dependency hygiene *(lens 08)*
7. **Remove `expo-sensors`** (`package.json:58`) — declared, never imported.
8. **Add `@expo/config-plugins` as an explicit devDependency** (pin to the
   Expo-compatible range, currently `~54.0.4`) — used by
   `plugins/withHealthConnectRationale.js:18` but only resolved transitively today;
   a phantom dep that can break `expo prebuild`/EAS on a hoisting change.
9. **(Optional) CI guard:** add `depcheck` (or `import/no-extraneous-dependencies`)
   to the `validate` chain, configured to treat `NodeTileLoader.ts` and `scripts/**`
   as devDependency contexts (so `better-sqlite3`/`shapefile`/`sharp` tooling imports
   aren't false-flagged).

### Sensitive-data log hygiene *(lens 09)*
10. **Gate the two debug logs** behind `__DEV__` — `src/services/HealthService.ts:144,148`
    (the `:148` one logs the permission-response object; metadata, not health values,
    but it ships in release builds).

### Docs / CI alignment *(lens 12)*
11. **Fix the `CLAUDE.md` validate table** (`CLAUDE.md:19-31`): it lists 7 steps; the
    real `npm run validate` (`package.json:41`) runs 11. Add rows for
    `validate:display`, `validate:resources`, `validate:balance`, `validate:icons`.
12. **Add `validate:icons` to CI** (decided) — `.github/workflows/ci.yml` omits the
    step the npm `validate` script runs. Add it after `validate:balance`, before
    `doctor`, restoring the parity `CLAUDE.md:31` already claims.
13. **(Optional) Prevent recurrence:** a tiny meta-check asserting the `validate`
    sub-commands == the `ci.yml` steps == the documented table, so the three-way
    alignment is self-enforcing (the repo's own Manual Quality Check #3 already
    mandates it manually).

**Validate.** `npm run validate` (now the corrected 11-step chain). Re-run `tsc`
after the dead-export deletions.

---

## Stage 8 — Feature wiring (behaviour-adding)

Two survey "dead field" findings were resolved as *connect them*, not *delete* —
so they add behaviour and need their own stage with real test/balance coverage, not
the Stage 7 housekeeping batch.

1. **Surface `scientificName`** *(decided)* — add a resource-detail surface (e.g. an
   expanded row or detail view in `InventoryScreen`) that displays the species name
   already carried on each `WoodType`/`FoodType`, connecting the ~110 data entries to
   the UI. Add a render test asserting it shows. *(lens 10 #6)*
2. **Wire `realmBiomes` into spawn weighting** *(decided)* — use `realmBiomes` in
   `src/services/ResourceSpawnService.ts` alongside `nativeRealms` so the populated
   data influences resource selection. **This changes game balance**, so: add
   `ResourceSpawnService` tests asserting the new weighting (preference, not just
   membership — see Stage 6 #2), and confirm `validate:resources` + `validate:balance`
   still pass (adjust data/thresholds if the new weighting shifts coverage). Treat
   this as a feature, not a cleanup. *(lens 10 #7)*

**Validate.** Full `npm run validate` — the balance/resource validators are the gate
that the new weighting didn't break toolstone/resource coverage.

---

## Decisions (resolved)

| Item | Decision |
|------|----------|
| `eslint no-floating-promises` | **Enable type-aware lint** (Stage 1.5) |
| Two dead barrels | **Delete both** (Stage 7.2) |
| `scientificName` field | **Wire to a detail view** (Stage 8.1) |
| `realmBiomes` field | **Wire into spawn weighting** (Stage 8.2) |
| `validate:icons` in CI | **Add to ci.yml** (Stage 7.12) |

## Suggested sequencing

Stages 1 → 2 → 3 are the correctness core and share the `useGameState`/
`HealthService` surface, so land them in order. Stage 6 (tests) should precede or
accompany Stage 5 (render) to protect the refactor, and also lands the
preference-style spawn assertions that Stage 8.2 depends on. Stage 4 and Stage 7 are
independent and can slot in anywhere. Stage 8 (behaviour-adding) goes last, after the
test hardening it relies on. Each stage is its own PR ending on a green
`npm run validate`.

Execution order: **1 → 2 → 3 → 6 → 5 → 4 → 7 → 8**.

## Execution note

For implementation, route each stage through a `sandbox-feature-work` (or, for the
audit-style ones, `sandbox-quality-improvement`) demesne pipeline — the in-sandbox
`npm run validate` is the authoritative gate — then land via branch fetch + a cheap
host re-check. Stages 1–3 and 8 are behaviour-changing and warrant the per-phase
validate + review loop; Stage 7 is mechanical enough for a `sandbox-migration-sweep`
batch.
