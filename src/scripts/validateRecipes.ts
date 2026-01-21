/**
 * Recipe Validation Script
 *
 * Checks for:
 * 1. Orphaned tools - tools never used as prerequisites and have no mechanical effect
 * 2. Orphaned components - components never used in any recipe
 * 3. Missing references - tools/components referenced but don't exist
 * 4. Invalid tech references - requiredTech doesn't exist in tech tree
 * 5. Missing enablesRecipes - tech tree references non-existent tools/components
 * 6. Circular dependencies - tools that require themselves (directly or indirectly)
 * 7. Tech prerequisite/unlock symmetry - if A unlocks B, B should require A (and vice versa)
 * 8. Tech prerequisite existence - all tech prerequisites reference existing techs
 * 9. Circular tech prerequisites - techs that require themselves (directly or indirectly)
 * 10. Gathering material consistency - gatheringMaterial and gatheringBonus must be set together
 * 11. Gathering material validity - gatheringMaterial must be a valid GatherableMaterial
 * 12. Tech enables something - every tech must enable at least one unlock or recipe
 *
 * Run with: npx ts-node src/scripts/validateRecipes.ts
 */

import { TOOLS, COMPONENTS, TOOLS_BY_ID } from '../data/tools';
import { TECHNOLOGIES, TECH_BY_ID } from '../data/techTree';
import { getAllMaterialTypes } from '../config/materials';

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
    for (const reqToolId of tool.requiredTools) {
      if (!allToolIds.has(reqToolId)) {
        result.errors.push(`Tool "${tool.id}" requires non-existent tool "${reqToolId}"`);
      } else {
        toolsUsedAsPrereq.add(reqToolId);
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

    // Validate gathering material consistency
    const hasGatheringBonus = tool.baseStats.gatheringBonus > 0;
    if (hasGatheringBonus && !tool.gatheringMaterial) {
      result.errors.push(
        `Tool "${tool.id}" has gatheringBonus (${tool.baseStats.gatheringBonus}) but no gatheringMaterial`
      );
    }
    if (!hasGatheringBonus && tool.gatheringMaterial) {
      result.errors.push(
        `Tool "${tool.id}" has gatheringMaterial "${tool.gatheringMaterial}" but gatheringBonus is 0`
      );
    }
    // Verify gatheringMaterial is a valid MaterialType
    if (tool.gatheringMaterial) {
      const validMaterials = getAllMaterialTypes();
      if (!validMaterials.includes(tool.gatheringMaterial)) {
        result.errors.push(
          `Tool "${tool.id}" has invalid gatheringMaterial "${tool.gatheringMaterial}"`
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
    for (const reqToolId of comp.requiredTools) {
      if (!allToolIds.has(reqToolId)) {
        result.errors.push(`Component "${comp.id}" requires non-existent tool "${reqToolId}"`);
      } else {
        toolsUsedAsPrereq.add(reqToolId);
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
          recipeId.includes('_binding') ||
          recipeId.includes('_knife') ||
          recipeId.includes('_scraper') ||
          recipeId.includes('_adze')
        ) {
          result.warnings.push(
            `Tech "${tech.id}" enables recipe "${recipeId}" which doesn't exist as tool or component`
          );
        }
      }
    }
  }

  // ========== 3b. Validate Tech Prerequisites Exist ==========
  for (const tech of TECHNOLOGIES) {
    for (const prereqId of tech.prerequisites) {
      if (!allTechIds.has(prereqId)) {
        result.errors.push(`Tech "${tech.id}" has non-existent prerequisite "${prereqId}"`);
      }
    }
  }

  // ========== 3c. Validate Tech Unlocks Exist ==========
  for (const tech of TECHNOLOGIES) {
    for (const unlockId of tech.unlocks) {
      if (!allTechIds.has(unlockId)) {
        result.errors.push(`Tech "${tech.id}" unlocks non-existent tech "${unlockId}"`);
      }
    }
  }

  // ========== 3d. Validate Tech Prerequisite/Unlock Symmetry ==========
  // If tech A has unlocks: ['B'], then tech B should have prerequisites containing A
  for (const tech of TECHNOLOGIES) {
    for (const unlockId of tech.unlocks) {
      const unlockedTech = TECH_BY_ID[unlockId];
      if (unlockedTech) {
        const hasMatchingPrereq = unlockedTech.prerequisites.includes(tech.id);
        if (!hasMatchingPrereq) {
          result.errors.push(
            `Tech "${tech.id}" unlocks "${unlockId}", but "${unlockId}" doesn't have "${tech.id}" as a prerequisite`
          );
        }
      }
    }
  }

  // If tech B has prerequisites containing A, then tech A should have unlocks containing B
  for (const tech of TECHNOLOGIES) {
    for (const prereqId of tech.prerequisites) {
      const prereqTech = TECH_BY_ID[prereqId];
      if (prereqTech) {
        const hasMatchingUnlock = prereqTech.unlocks.includes(tech.id);
        if (!hasMatchingUnlock) {
          result.errors.push(
            `Tech "${tech.id}" requires "${prereqId}", but "${prereqId}" doesn't have "${tech.id}" in its unlocks`
          );
        }
      }
    }
  }

  // ========== 3e. Check for Circular Tech Prerequisites ==========
  for (const tech of TECHNOLOGIES) {
    const visited = new Set<string>();
    const queue = [...tech.prerequisites];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === tech.id) {
        result.errors.push(
          `Tech "${tech.id}" has a circular prerequisite dependency (requires itself)`
        );
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const dep = TECH_BY_ID[current];
      if (dep) {
        queue.push(...dep.prerequisites);
      }
    }
  }

  // ========== 3f. Validate Tech Enables Something ==========
  for (const tech of TECHNOLOGIES) {
    const enablesSomething = tech.unlocks.length > 0 || tech.enablesRecipes.length > 0;
    if (!enablesSomething) {
      result.errors.push(
        `Tech "${tech.id}" doesn't enable anything (no unlocks or enablesRecipes)`
      );
    }
  }

  // ========== 4. Check for Orphaned Tools ==========
  for (const tool of TOOLS) {
    const isUsedAsPrereq = toolsUsedAsPrereq.has(tool.id);
    const isInTechTree = toolsInTechTree.has(tool.id);
    const hasGatheringBonus = tool.baseStats.gatheringBonus > 0;

    if (!isUsedAsPrereq && !hasGatheringBonus) {
      result.warnings.push(
        `Tool "${tool.id}" is never used as a prerequisite and has no gathering bonus`
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
    const queue = [...tool.requiredTools];

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
        queue.push(...dep.requiredTools);
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

  // Era distribution
  const eraCounts: Record<string, number> = {};
  for (const tool of TOOLS) {
    eraCounts[tool.era] = (eraCounts[tool.era] || 0) + 1;
  }
  result.info.push(
    `Tool era distribution: ${Object.entries(eraCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  for (const tool of TOOLS) {
    categoryCounts[tool.category] = (categoryCounts[tool.category] || 0) + 1;
  }
  result.info.push(
    `Tool category distribution: ${Object.entries(categoryCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );

  return result;
}

// Main execution
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

// Export for use as module
export { validateRecipes, ValidationResult };

// Run if executed directly
if (require.main === module) {
  main();
}
