/**
 * Display Text Validation Script
 *
 * Validates that text content fits within expected UI constraints.
 * Run with: npm run validate:display
 */

import { TOOLS, COMPONENTS } from '../data/tools';
import { STONES } from '../data/stones';
import { WOODS } from '../data/woods';
import { DISPLAY_CONSTRAINTS, getMaxChars, TextConstraint } from '../config/displayConstraints';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

interface TextItem {
  id: string;
  text: string;
  category: string; // e.g., "tool", "stone"
  field: string; // e.g., "name", "description"
}

function validateTextFits(
  item: TextItem,
  constraint: TextConstraint,
  result: ValidationResult
): void {
  const maxChars = getMaxChars(constraint);
  const textLength = item.text.length;

  if (textLength > maxChars) {
    // Calculate overflow severity
    const overflowPercent = ((textLength - maxChars) / maxChars) * 100;

    if (overflowPercent > 20) {
      result.errors.push(
        `${item.category} "${item.id}" ${item.field} too long: ${textLength} chars ` +
          `(max ${maxChars} for ${constraint.maxLines} line(s) at ${constraint.fontSize}px)`
      );
    } else {
      result.warnings.push(
        `${item.category} "${item.id}" ${item.field} may overflow: ${textLength} chars ` +
          `(target ${maxChars} for ${constraint.maxLines} line(s))`
      );
    }
  }
}

function validateDisplay(): ValidationResult {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    info: [],
  };

  // Validate tool names and descriptions
  for (const tool of TOOLS) {
    validateTextFits(
      { id: tool.id, text: tool.name, category: 'Tool', field: 'name' },
      DISPLAY_CONSTRAINTS.toolName,
      result
    );
    validateTextFits(
      { id: tool.id, text: tool.description, category: 'Tool', field: 'description' },
      DISPLAY_CONSTRAINTS.toolDescription,
      result
    );
  }

  // Validate component names and descriptions
  for (const comp of COMPONENTS) {
    validateTextFits(
      { id: comp.id, text: comp.name, category: 'Component', field: 'name' },
      DISPLAY_CONSTRAINTS.componentName,
      result
    );
    validateTextFits(
      { id: comp.id, text: comp.description, category: 'Component', field: 'description' },
      DISPLAY_CONSTRAINTS.componentDescription,
      result
    );
  }

  // Validate stone names and descriptions
  for (const stone of STONES) {
    validateTextFits(
      { id: stone.id, text: stone.name, category: 'Stone', field: 'name' },
      DISPLAY_CONSTRAINTS.resourceName,
      result
    );
    validateTextFits(
      { id: stone.id, text: stone.description, category: 'Stone', field: 'description' },
      DISPLAY_CONSTRAINTS.resourceDescription,
      result
    );
  }

  // Validate wood names and descriptions
  for (const wood of WOODS) {
    validateTextFits(
      { id: wood.id, text: wood.name, category: 'Wood', field: 'name' },
      DISPLAY_CONSTRAINTS.resourceName,
      result
    );
    validateTextFits(
      { id: wood.id, text: wood.description, category: 'Wood', field: 'description' },
      DISPLAY_CONSTRAINTS.resourceDescription,
      result
    );
  }

  // Summary statistics
  result.info.push(`Validated ${TOOLS.length} tools, ${COMPONENTS.length} components`);
  result.info.push(`Validated ${STONES.length} stones, ${WOODS.length} woods`);
  result.info.push(
    `Display constraints: tool desc ${getMaxChars(DISPLAY_CONSTRAINTS.toolDescription)} chars, ` +
      `resource desc ${getMaxChars(DISPLAY_CONSTRAINTS.resourceDescription)} chars`
  );

  return result;
}

// Main execution
function main() {
  console.log('='.repeat(60));
  console.log('Display Text Validation Report');
  console.log('='.repeat(60));
  console.log('');

  const result = validateDisplay();

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

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

// Export for use as module
export { validateDisplay, ValidationResult };

// Run if executed directly
main();
