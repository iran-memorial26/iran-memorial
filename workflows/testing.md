# Workflow: Testing

## Objective
Run, extend, and maintain the Vitest test suite to ensure code quality and prevent regressions.

---

## Prerequisites
- Node.js 18+ installed
- `npm install` completed (devDependencies include vitest, @testing-library/react, etc.)

---

## Running Tests

### Full Suite
```bash
npm test                    # Run all tests once
npm run test:watch          # Watch mode (re-run on file changes)
npm run test:coverage       # Run with v8 coverage report
```

### Specific Tests
```bash
npx vitest run __tests__/lib/          # Only lib tests
npx vitest run __tests__/api/          # Only API route tests
npx vitest run __tests__/components/   # Only component tests
npx vitest run __tests__/lib/utils     # Single test file
```

---

## Test Structure

```
__tests__/
├── setup.ts                      # jest-dom matchers
├── tsconfig.json                 # vitest/globals types
├── helpers/
│   ├── fixtures.ts               # Shared test data (mockVictimRow, validSubmission)
│   ├── mock-next-intl.ts         # next-intl mock pattern docs
│   └── mock-navigation.ts       # i18n/navigation mock factory
├── lib/                          # Tier 1: Pure functions (no mocks)
│   ├── utils.test.ts             # formatDate, formatNumber, etc.
│   ├── queries.test.ts           # localized(), mapRawVictims()
│   └── rate-limit.test.ts        # In-memory rate limiter
├── api/                          # Tier 2+3: Schema + API routes
│   ├── submit-schema.test.ts     # Zod schema validation
│   ├── search-route.test.ts      # GET /api/search
│   └── submit-route.test.ts      # POST /api/submit
└── components/                   # Tier 4: React components
    ├── VictimCard.test.tsx        # Card rendering, locales, photo/fallback
    ├── SearchBar.test.tsx         # Form submit, encoding, styling
    ├── LanguageSwitcher.test.tsx  # Locale switching, active state
    ├── Header.test.tsx           # Nav items, mobile menu
    └── FilterBar.test.tsx        # Dropdowns, gender buttons, URL params
```

---

## Writing New Tests

### Step 1: Choose the Right Tier

| Tier | What to Test | Mocks Needed | Example |
|------|-------------|--------------|---------|
| 1 | Pure functions | None | `lib/utils.ts` |
| 2 | Zod schemas | None (inline schema) | Submit validation |
| 3 | API routes | `vi.mock("@/lib/db")`, `vi.mock("@/lib/rate-limit")` | Route handlers |
| 4 | Components | `vi.mock("next-intl")`, `vi.mock("@/i18n/navigation")` | React components |

### Step 2: Follow Existing Patterns

**Pure function test:**
```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "@/lib/myModule";

describe("myFunction", () => {
  it("handles normal input", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

**API route test (mock DB + rate limiter):**
```typescript
vi.mock("@/lib/db", () => ({ prisma: { model: { method: vi.fn() } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

import { GET } from "@/app/api/myroute/route";
// ... set up mocks in beforeEach, create NextRequest, assert response
```

**Component test (mock next-intl + navigation):**
```typescript
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));
vi.mock("@/i18n/navigation", () => {
  const React = require("react");
  return {
    Link: ({ href, children, ...props }: any) =>
      React.createElement("a", { href, ...props }, children),
    useRouter: vi.fn(),
    usePathname: vi.fn(),
  };
});
```

### Step 3: Verify

```bash
npx vitest run __tests__/path/to/new.test.ts
npm test   # Ensure no regressions
```

---

## Coverage Goals

| Area | Target |
|------|--------|
| Pure Functions (`lib/`) | 100% |
| Zod Schemas | 100% |
| API Routes | 95% |
| Components | 90% |
| **Overall Threshold** | **70% statements, 60% branches** |

Check coverage:
```bash
npm run test:coverage
# Reports: coverage/index.html (visual), terminal summary
```

---

## Common Pitfalls

1. **vi.mock hoisting**: `vi.mock()` is hoisted above imports. Use `vi.fn()` in factories and `vi.mocked()` after import to set up return values.
2. **JSX in vi.mock**: Use `require("react").createElement()` instead of JSX inside `vi.mock()` factories.
3. **Prisma client**: Always mock `@/lib/db` when testing modules that import from it — prevents real DB connections.
4. **Fake timers**: Use `vi.useFakeTimers()` / `vi.useRealTimers()` for time-dependent tests (rate-limit). Always restore in `afterEach`.
5. **next/image**: Mock as simple `<img>` element via `vi.mock("next/image")`.

---

## Evaluation Checklist (after test runs)

- [ ] All tests pass (`npm test`)
- [ ] No skipped tests without documented reason
- [ ] Coverage meets thresholds (`npm run test:coverage`)
- [ ] New code has corresponding tests
- [ ] `test-results.json` generated (for CI/reporting)

---

## Python Enricher Tests (pytest)

The enricher data pipeline has its own test suite using pytest.

### Running Enricher Tests

```bash
python3 -m pytest tools/enricher/tests/ -v        # All enricher tests (100)
python3 -m pytest tools/enricher/tests/test_provinces.py -v   # Province mapping only
python3 -m pytest tools/enricher/tests/test_iranvictims.py -v # iranvictims CSV only
python3 -m pytest tools/enricher/tests/test_telegram_rtn.py -v # Telegram RTN plugin
```

### Enricher Test Structure

```
tools/enricher/tests/
├── __init__.py
├── test_provinces.py           # 8 tests — Province mapping utility
├── test_iranvictims.py         # 26 tests — CSV parsing, age, date, URL parsing
├── test_iranrevolution.py      # 10 tests — Supabase record parsing
├── test_enricher_pipeline.py   # 9 tests — circumstances_fa enrichment pipeline
└── test_telegram_rtn.py        # 47 tests — Telegram parsing, Jalali dates, Farsi city mapping
```

### Test Results (2026-02-15)

```
100 passed in 0.10s
- test_provinces: 8/8 ✅
- test_iranvictims: 26/26 ✅
- test_iranrevolution: 10/10 ✅
- test_enricher_pipeline: 9/9 ✅
- test_telegram_rtn: 47/47 ✅
```

---

## Combined Test Summary

| Suite | Framework | Tests | Time |
|-------|-----------|-------|------|
| Frontend | Vitest + Testing Library | 124 | <1.2s |
| Enricher | pytest | 100 | 0.10s |
| **Total** | | **224** | **<1.3s** |

---

## E2E Tests (Playwright)

Playwright E2E tests verify critical user flows against a running app.

### Setup
```bash
npx playwright install chromium   # Install browser
npx playwright test               # Run E2E tests
npx playwright test --headed      # Run with visible browser
```

### E2E Test Structure
```
e2e/
└── navigation.spec.ts   # Homepage, navigation, search, submit, API endpoints
```

### What E2E Tests Cover
- Homepage loads with victim count
- Navigation to victims, timeline, map pages
- Language switcher (RTL for Farsi)
- Search form submission
- Submit form presence
- API endpoints respond (search, export, sitemap, robots.txt)

---

## CI/CD Pipeline (GitHub Actions)

Automated testing runs on every push to `main` and every pull request.

### Workflow: `.github/workflows/test.yml`

| Job | Runner | What it does |
|-----|--------|-------------|
| `vitest` | Node 22 | `npm ci && npm test` |
| `pytest` | Python 3.12 | `pip install pytest beautifulsoup4 && python -m pytest tools/enricher/tests/ -v` |
| `build` | Node 22 | `npm ci && npx prisma generate && npm run build` (depends on vitest) |

---

## TODOs for Future Testing

- [ ] Integration tests: Full page render with mocked DB data
- [x] ~~E2E tests: Playwright for critical user flows~~ (**Done** — `e2e/navigation.spec.ts`)
- [x] ~~CI pipeline: GitHub Actions workflow~~ (**Done** — `.github/workflows/test.yml`)
- [ ] Visual regression: Screenshot testing for VictimCard, Header
- [ ] Accessibility: axe-core integration for a11y checks
- [ ] Performance: Lighthouse CI for page load budgets
- [ ] Enricher: Integration tests with mocked asyncpg/aiohttp for full pipeline
