# WalkForage App - Claude Code Instructions

## Project Overview

WalkForage is a React Native/Expo app where players gather resources by walking. It uses HealthConnect (Android) and HealthKit (iOS) for step counting.

## Validation Process

After making changes, perform both automated and manual quality checks.

### Automated Validation

Run all automated checks with a single command:

```bash
npm run validate
```

This executes the following in order:

| Step            | Command                    | Description                     |
| --------------- | -------------------------- | ------------------------------- |
| 1. TypeScript   | `npm run typecheck`        | Type checking with tsc --noEmit |
| 2. ESLint       | `npm run lint`             | Linting TypeScript/React code   |
| 3. Prettier     | `npm run format:check`     | Check code formatting           |
| 4. Jest         | `npm run test`             | Run all unit tests              |
| 5. Recipes      | `npm run validate:recipes` | Validate crafting recipes       |
| 6. Expo Doctor  | `npm run doctor`           | Check Expo project health       |
| 7. Dependencies | `npm run deps:check`       | Check Expo SDK compatibility    |

All these checks are also configured in `.github/workflows/ci.yml` and run on every push and PR.

### Manual Quality Checks

After automated validation passes, review code for these issues:

1. **Duplicate Code**: Check for repeated definitions (constants, types, helper functions) that should be consolidated. Common locations for shared code:
   - `src/types/` - Type definitions and related constants
   - `src/utils/` - Utility functions
   - `src/config/` - Configuration constants

2. **Incomplete or Disconnected Logic**: Look for:
   - Legacy mechanisms or functions left in the code instead of being removed
   - Fields in types/interfaces that are never read or written
   - Functions that are defined but never called
   - Data properties that don't connect to any UI display
   - Features partially implemented but not wired up
   - TODO comments indicating unfinished work

3. **Validation Script Coverage**: Ensure any new validation scripts are:
   - Added to `package.json` scripts
   - Included in the `validate` npm script chain
   - Added to `.github/workflows/ci.yml`

4. **Tool Description Accuracy**: Review tool and component descriptions in `src/data/tools.ts` for:
   - **Historical accuracy**: Descriptions should reflect the tool's real-world historical role and usage
   - **Game mechanics alignment**: Don't describe tools as prerequisites for things they aren't in game (check `requiredTools` arrays)
   - **Gathering role accuracy**: If a tool has `gatheringBonus > 0`, the description should mention its gathering purpose; if it's purely a crafting prerequisite, don't imply gathering benefits
   - **Display length**: Descriptions display with `numberOfLines={2}` in recipe views - keep descriptions concise enough to fit (roughly 100-120 characters max)
   - **Consistency**: Use consistent terminology across similar tools (e.g., "hafted" vs "handled")

5. **Redundant fields or parameters**: Look for:
   - Fields that contain information present in or inferrable from other fields
   - Parameters that contain information present in or inferrable from other fields

6. **Poor use of types**: Look for:
   - Code performing type switches to determine what functionality a field supports when it could be using a method on the type instead.

## Build Commands

This project requires a development build (not Expo Go) due to native health modules:

```bash
# Build development APK for Android
eas build --platform android --profile development

# Build preview APK (no dev tools)
eas build --platform android --profile preview
```

## Key Directories

- `src/types/` - TypeScript type definitions
- `src/services/` - Business logic services (HealthService, ResourceSpawnService, etc.)
- `src/hooks/` - React hooks (useGameState, useStepGathering, useLocation)
- `src/components/` - Reusable UI components
- `src/screens/` - Screen components
- `src/data/` - Static data (stones, woods, tech tree)
- `src/config/` - Configuration constants
