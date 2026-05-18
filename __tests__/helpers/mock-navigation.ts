/**
 * i18n/navigation mock helper for component tests.
 *
 * Usage in test files:
 *   vi.mock("@/i18n/navigation", () => {
 *     const React = require("react");
 *     return {
 *       Link: ({ href, children, ...props }: any) =>
 *         React.createElement("a", { href, ...props }, children),
 *       useRouter: vi.fn(),
 *       usePathname: vi.fn(),
 *     };
 *   });
 *
 *   import { useRouter } from "@/i18n/navigation";
 *   const mockUseRouter = vi.mocked(useRouter);
 *   mockUseRouter.mockReturnValue({ push: vi.fn(), replace: vi.fn() } as any);
 */

import { vi } from "vitest";

/** Factory that creates a fresh mock router with all methods. */
export function createMockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
}
