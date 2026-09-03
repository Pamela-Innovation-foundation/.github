// test/config.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjectName,
  enableGuard,
  disableGuard,
  isGuardEnabled,
  setGuardConfig,
  getGuardConfig,
  resetGuard,
  applyProjectNameGuard,
} from '../src/config';

describe('Project Name Guard Mechanism', () => {
  beforeEach(() => {
    // Reset guard to default state before each test
    resetGuard();
  });

  describe('getProjectName', () => {
    it('returns replacement name when guard is enabled', () => {
      enableGuard();
      expect(getProjectName()).toBe('pamela');
    });

    it('returns original name when guard is disabled', () => {
      disableGuard();
      expect(getProjectName()).toBe('My Cool Project');
    });

    it('returns replacement name by default', () => {
      expect(getProjectName()).toBe('pamela');
    });
  });

  describe('enableGuard and disableGuard', () => {
    it('enables guard correctly', () => {
      disableGuard();
      expect(isGuardEnabled()).toBe(false);
      enableGuard();
      expect(isGuardEnabled()).toBe(true);
    });

    it('disables guard correctly', () => {
      enableGuard();
      expect(isGuardEnabled()).toBe(true);
      disableGuard();
      expect(isGuardEnabled()).toBe(false);
    });
  });

  describe('isGuardEnabled', () => {
    it('returns true when guard is enabled', () => {
      enableGuard();
      expect(isGuardEnabled()).toBe(true);
    });

    it('returns false when guard is disabled', () => {
      disableGuard();
      expect(isGuardEnabled()).toBe(false);
    });

    it('returns true by default', () => {
      expect(isGuardEnabled()).toBe(true);
    });
  });

  describe('setGuardConfig', () => {
    it('updates enabled state', () => {
      setGuardConfig({ enabled: false });
      expect(isGuardEnabled()).toBe(false);
      expect(getProjectName()).toBe('My Cool Project');
    });

    it('updates replacement name', () => {
      setGuardConfig({ replacementName: 'custom-name' });
      expect(getProjectName()).toBe('custom-name');
    });

    it('updates original name', () => {
      setGuardConfig({ originalName: 'Old Project' });
      disableGuard();
      expect(getProjectName()).toBe('Old Project');
    });

    it('updates multiple properties at once', () => {
      setGuardConfig({
        enabled: false,
        originalName: 'Original',
        replacementName: 'Replacement',
      });
      expect(isGuardEnabled()).toBe(false);
      expect(getProjectName()).toBe('Original');
    });

    it('preserves unmodified properties', () => {
      setGuardConfig({ enabled: false });
      const config = getGuardConfig();
      expect(config.originalName).toBe('My Cool Project');
      expect(config.replacementName).toBe('pamela');
    });
  });

  describe('getGuardConfig', () => {
    it('returns current configuration', () => {
      const config = getGuardConfig();
      expect(config).toEqual({
        enabled: true,
        originalName: 'My Cool Project',
        replacementName: 'pamela',
      });
    });

    it('returns updated configuration after changes', () => {
      setGuardConfig({ replacementName: 'test-name' });
      const config = getGuardConfig();
      expect(config.replacementName).toBe('test-name');
    });

    it('returns a copy of the configuration', () => {
      const config1 = getGuardConfig();
      const config2 = getGuardConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('resetGuard', () => {
    it('resets to default configuration', () => {
      setGuardConfig({
        enabled: false,
        originalName: 'Custom',
        replacementName: 'Custom2',
      });
      resetGuard();
      const config = getGuardConfig();
      expect(config).toEqual({
        enabled: true,
        originalName: 'My Cool Project',
        replacementName: 'pamela',
      });
    });

    it('resets enabled state', () => {
      disableGuard();
      resetGuard();
      expect(isGuardEnabled()).toBe(true);
    });
  });

  describe('applyProjectNameGuard', () => {
    it('replaces original name with replacement when guard is enabled', () => {
      enableGuard();
      const text = 'Welcome to My Cool Project!';
      const result = applyProjectNameGuard(text);
      expect(result).toBe('Welcome to pamela!');
    });

    it('does not replace when guard is disabled', () => {
      disableGuard();
      const text = 'Welcome to My Cool Project!';
      const result = applyProjectNameGuard(text);
      expect(result).toBe('Welcome to My Cool Project!');
    });

    it('replaces all instances in text', () => {
      enableGuard();
      const text = 'My Cool Project is great! My Cool Project rocks!';
      const result = applyProjectNameGuard(text);
      expect(result).toBe('pamela is great! pamela rocks!');
    });

    it('returns unchanged text when no match is found', () => {
      enableGuard();
      const text = 'This is some other text';
      const result = applyProjectNameGuard(text);
      expect(result).toBe('This is some other text');
    });

    it('works with custom names', () => {
      setGuardConfig({
        enabled: true,
        originalName: 'OldName',
        replacementName: 'NewName',
      });
      const text = 'This is OldName project';
      const result = applyProjectNameGuard(text);
      expect(result).toBe('This is NewName project');
    });

    it('handles empty string', () => {
      enableGuard();
      const result = applyProjectNameGuard('');
      expect(result).toBe('');
    });
  });

  describe('Integration scenarios', () => {
    it('can toggle guard on and off programmatically', () => {
      // Start enabled
      expect(getProjectName()).toBe('pamela');

      // Disable for testing
      disableGuard();
      expect(getProjectName()).toBe('My Cool Project');

      // Re-enable
      enableGuard();
      expect(getProjectName()).toBe('pamela');
    });

    it('can temporarily change configuration for debugging', () => {
      const originalConfig = getGuardConfig();

      // Change for debugging
      setGuardConfig({ replacementName: 'debug-mode' });
      expect(getProjectName()).toBe('debug-mode');

      // Restore original
      setGuardConfig(originalConfig);
      expect(getProjectName()).toBe('pamela');
    });

    it('can use guard in different contexts', () => {
      const messages = [
        'Welcome to My Cool Project',
        'My Cool Project - Version 1.0',
        'Documentation for My Cool Project',
      ];

      enableGuard();
      const replaced = messages.map(msg => applyProjectNameGuard(msg));
      expect(replaced).toEqual([
        'Welcome to pamela',
        'pamela - Version 1.0',
        'Documentation for pamela',
      ]);

      disableGuard();
      const original = messages.map(msg => applyProjectNameGuard(msg));
      expect(original).toEqual(messages);
    });
  });
});
