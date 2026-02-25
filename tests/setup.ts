/**
 * Vitest global setup file.
 *
 * Runs before every test file. Use it to set environment defaults and
 * silence noisy console output during tests.
 */
import { vi } from 'vitest';

// Silence console.log / console.error in tests to keep output clean.
// Individual tests can restore them with `vi.restoreAllMocks()` if needed.
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
