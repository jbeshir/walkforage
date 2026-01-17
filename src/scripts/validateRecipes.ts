/**
 * Recipe Validation Script
 *
 * Checks for:
 * 1. Orphaned tools - tools never used as prerequisites and have no mechanical effect
 * 2. Orphaned components - components never used in any recipe
 * 3. Missing references - tools/components referenced but don't exist
 * 4. Invalid tech references - requiredTech doesn't exist in tech tree
 * 5. Broken upgrade chains - upgradesTo/upgradesFrom point to non-existent tools
 * 6. Missing enablesRecipes - tech tree references non-existent tools/components
 * 7. Circular dependencies - tools that require themselves (directly or indirectly)
 *
 * Run with: npx ts-node src/scripts/validateRecipes.ts
 */

import { TOOLS, COMPONENTS, TOOLS_BY_ID } from '../data/tools';
import { TECHNOLOGIES } from '../data/techTree';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

function validateRecipes(): ValidationResult {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    info: [],
  };

  const allToolIds = new Set(TOOLS.map((t) => t.id));
  const allComponentIds = new Set(COMPONENTS.map((c) => c.id));
  const allTechIds = new Set(TECHNOLOGIES.map((t) => t.id));

  // Track usage
  const toolsUsedAsPrereq = new Set<string>();
  const componentsUsed = new Set<string>();
  const toolsInTechTree = new Set<string>();
  const componentsInTechTree = new Set<string>();

  // ========== 1. Validate Tool Definitions ==========
  for (const tool of TOOLS) {
    // Check requiredTech exists
    if (!allTechIds.has(tool.requiredTech)) {
      result.errors.push(`Tool "${tool.id}" requires non-existent tech "${tool.requiredTech}"`);
    }

    // Check required tools exist
    for (const req of tool.requiredTools) {
      if (!allToolIds.has(req.toolId)) {
        result.errors.push(`Tool "${tool.id}" requires non-existent tool "${req.toolId}"`);
      } else {
        toolsUsedAsPrereq.add(req.toolId);
      }
    }

    // Check required components exist
    for (const comp of tool.requiredComponents) {
      if (!allComponentIds.has(comp.componentId)) {
        result.errors.push(
          `Tool "${tool.id}" requires non-existent component "${comp.componentId}"`
        );
      } else {
        componentsUsed.add(comp.componentId);
      }
    }

    // Check upgrade chain
    if (tool.upgradesTo && !allToolIds.has(tool.upgradesTo)) {
      result.errors.push(`Tool "${tool.id}" upgradesTo non-existent tool "${tool.upgradesTo}"`);
    }
    if (tool.upgradesFrom && !allToolIds.has(tool.upgradesFrom)) {
      result.errors.push(`Tool "${tool.id}" upgradesFrom non-existent tool "${tool.upgradesFrom}"`);
    }

    // Check upgrade chain consistency
    if (tool.upgradesTo) {
      const upgradedTool = TOOLS_BY_ID[tool.upgradesTo];
      if (upgradedTool && upgradedTool.upgradesFrom !== tool.id) {
        result.warnings.push(
          `Tool "${tool.id}" upgradesTo "${tool.upgradesTo}" but that tool's upgradesFrom is "${upgradedTool.upgradesFrom}"`
        );
      }
    }
  }

  // ========== 2. Validate Component Definitions ==========
  for (const comp of COMPONENTS) {
    // Check requiredTech exists
    if (!allTechIds.has(comp.requiredTech)) {
      result.errors.push(
        `Component "${comp.id}" requires non-existent tech "${comp.requiredTech}"`
      );
    }

    // Check required tools exist
    for (const req of comp.requiredTools) {
      if (!allToolIds.has(req.toolId)) {
        result.errors.push(`Component "${comp.id}" requires non-existent tool "${req.toolId}"`);
      } else {
        toolsUsedAsPrereq.add(req.toolId);
      }
    }
  }

  // ========== 3. Validate Tech Tree References ==========
  for (const tech of TECHNOLOGIES) {
    for (const recipeId of tech.enablesRecipes) {
      if (allToolIds.has(recipeId)) {
        toolsInTechTree.add(recipeId);
      } else if (allComponentIds.has(recipeId)) {
        componentsInTechTree.add(recipeId);
      } else {
        // Could be a non-tool recipe (like 'charcoal', 'clay_pot', etc.)
        // Only warn if it looks like it should be a tool/component
        if (
          recipeId.includes('_hammer') ||
          recipeId.includes('_axe') ||
          recipeId.includes('_chisel') ||
          recipeId.includes('_handle') ||
          recipeId.includes('_head') ||
          recipeId.includes('_binding')
        ) {
          result.warnings.push(
            `Tech "${tech.id}" enables recipe "${recipeId}" which doesn't exist as tool or component`
          );
        }
      }
    }
  }

  // ========== 4. Check for Orphaned Tools ==========
  for (const tool of TOOLS) {
    const isUsedAsPrereq = toolsUsedAsPrereq.has(tool.id);
    const isInTechTree = toolsInTechTree.has(tool.id);
    const hasSpecialAbilities = tool.stats.specialAbilities.length > 0;
    const enablesCrafting = tool.enablesCrafting.length > 0;
    const enablesGathering = tool.enablesGathering.length > 0;
    const hasMechanicalEffect = hasSpecialAbilities || enablesCrafting || enablesGathering;

    if (!isUsedAsPrereq && !hasMechanicalEffect) {
      result.warnings.push(
        `Tool "${tool.id}" is never used as a prerequisite and has no special abilities or enables`
      );
    }

    if (!isInTechTree) {
      result.warnings.push(`Tool "${tool.id}" is not referenced in any tech's enablesRecipes`);
    }
  }

  // ========== 5. Check for Orphaned Components ==========
  for (const comp of COMPONENTS) {
    const isUsed = componentsUsed.has(comp.id);
    const isInTechTree = componentsInTechTree.has(comp.id);

    if (!isUsed) {
      result.errors.push(`Component "${comp.id}" is never used in any tool recipe`);
    }

    if (!isInTechTree) {
      result.warnings.push(`Component "${comp.id}" is not referenced in any tech's enablesRecipes`);
    }
  }

  // ========== 6. Check for Circular Dependencies ==========
  for (const tool of TOOLS) {
    const visited = new Set<string>();
    const queue = tool.requiredTools.map((r) => r.toolId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === tool.id) {
        result.errors.push(`Tool "${tool.id}" has a circular dependency (requires itself)`);
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const dep = TOOLS_BY_ID[current];
      if (dep) {
        queue.push(...dep.requiredTools.map((r) => r.toolId));
      }
    }
  }

  // ========== 7. Check Starting Tools ==========
  const startingTools = TOOLS.filter(
    (t) => t.requiredTools.length === 0 && t.requiredComponents.length === 0
  );

  if (startingTools.length === 0) {
    result.errors.push('No starting tools found! Players cannot craft anything.');
  } else {
    result.info.push(`Starting tools (no prereqs): ${startingTools.map((t) => t.id).join(', ')}`);
  }

  // ========== 8. Summary Statistics ==========
  result.info.push(`Total tools: ${TOOLS.length}`);
  result.info.push(`Total components: ${COMPONENTS.length}`);
  result.info.push(`Tools used as prerequisites: ${toolsUsedAsPrereq.size}`);
  result.info.push(`Components used in recipes: ${componentsUsed.size}`);
  result.info.push(`Tools in tech tree: ${toolsInTechTree.size}`);
  result.info.push(`Components in tech tree: ${componentsInTechTree.size}`);

  // Tier distribution
  const tierCounts: Record<string, number> = {};
  for (const tool of TOOLS) {
    tierCounts[tool.tier] = (tierCounts[tool.tier] || 0) + 1;
  }
  result.info.push(
    `Tool tier distribution: ${Object.entries(tierCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  return result;
}

// Main execution
/* eslint-disable no-console */
function main() {
  console.log('='.repeat(60));
  console.log('Recipe Validation Report');
  console.log('='.repeat(60));
  console.log('');

  const result = validateRecipes();

  if (result.errors.length > 0) {
    console.log('ERRORS:');
    console.log('-'.repeat(40));
    for (const error of result.errors) {
      console.log(`  [ERROR] ${error}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('WARNINGS:');
    console.log('-'.repeat(40));
    for (const warning of result.warnings) {
      console.log(`  [WARN]  ${warning}`);
    }
    console.log('');
  }

  console.log('INFO:');
  console.log('-'.repeat(40));
  for (const info of result.info) {
    console.log(`  [INFO]  ${info}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log(`Summary: ${result.errors.length} errors, ${result.warnings.length} warnings`);
  console.log('='.repeat(60));

  // Exit with error code if there are errors
  if (result.errors.length > 0) {
    process.exit(1);
  }
}
/* eslint-enable no-console */

// Export for use as module
export { validateRecipes, ValidationResult };

// Run if executed directly
if (require.main === module) {
  main();
}
