/**
 * next-intl mock helper for component tests.
 *
 * Usage in test files:
 *   vi.mock("next-intl", () => ({
 *     useTranslations: vi.fn(() => mockT),
 *   }));
 */

/** Key-passthrough translation function — returns the key unchanged. */
export const mockT = (key: string) => key;
