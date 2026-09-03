/**
 * Configuration module for managing project-wide settings
 * with guard mechanisms for conditional replacements
 */

/**
 * Guard configuration for project name replacement
 */
interface ProjectNameGuard {
  enabled: boolean;
  originalName: string;
  replacementName: string;
}

/**
 * Default guard configuration
 */
const defaultGuard: ProjectNameGuard = {
  enabled: true,
  originalName: 'My Cool Project',
  replacementName: 'pamela',
};

/**
 * Current guard state - can be modified programmatically
 */
let currentGuard: ProjectNameGuard = { ...defaultGuard };

/**
 * Get the current project name based on guard configuration
 * @returns The project name (either original or replacement based on guard state)
 */
export function getProjectName(): string {
  return currentGuard.enabled 
    ? currentGuard.replacementName 
    : currentGuard.originalName;
}

/**
 * Enable the guard mechanism (use replacement name)
 */
export function enableGuard(): void {
  currentGuard.enabled = true;
}

/**
 * Disable the guard mechanism (use original name)
 */
export function disableGuard(): void {
  currentGuard.enabled = false;
}

/**
 * Check if guard is currently enabled
 */
export function isGuardEnabled(): boolean {
  return currentGuard.enabled;
}

/**
 * Set custom guard configuration
 * @param config Partial guard configuration to update
 */
export function setGuardConfig(config: Partial<ProjectNameGuard>): void {
  currentGuard = { ...currentGuard, ...config };
}

/**
 * Get current guard configuration
 */
export function getGuardConfig(): Readonly<ProjectNameGuard> {
  return { ...currentGuard };
}

/**
 * Reset guard to default configuration
 */
export function resetGuard(): void {
  currentGuard = { ...defaultGuard };
}

/**
 * Replace project name in text based on guard configuration
 * @param text Text containing the original project name
 * @returns Text with project name replaced according to guard state
 */
export function applyProjectNameGuard(text: string): string {
  if (currentGuard.enabled) {
    return text.replace(
      new RegExp(currentGuard.originalName, 'g'),
      currentGuard.replacementName
    );
  }
  return text;
}
