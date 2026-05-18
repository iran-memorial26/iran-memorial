import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

import { useRouter, usePathname } from "@/i18n/navigation";
import { Header } from "@/components/Header";

const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: vi.fn(), replace: vi.fn() } as any);
  mockUsePathname.mockReturnValue("/");
});

describe("Header", () => {
  it("renders site name", () => {
    render(<Header locale="en" />);
    expect(screen.getByText("siteName")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<Header locale="en" />);
    // Consolidated IA: 5 primary surfaces + Submit CTA. Status-slicers
    // (executions/death-row/imprisoned/anonymous) and secondary surfaces
    // (statistics/developers/about) live in the footer, not top nav.
    expect(screen.getByText("victims")).toBeInTheDocument();
    expect(screen.getByText("events")).toBeInTheDocument();
    expect(screen.getByText("timeline")).toBeInTheDocument();
    expect(screen.getByText("map")).toBeInTheDocument();
    expect(screen.getByText("methodology")).toBeInTheDocument();
    // Submit CTA appears twice (desktop button + mobile menu), so use getAllByText
    expect(screen.getAllByText("submit").length).toBeGreaterThan(0);
  });

  it("renders language switcher with all locales", () => {
    render(<Header locale="en" />);
    // LanguageSwitcher renders compact ISO 639-1 abbreviations as the
    // visible option text; native names live in the title attribute.
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("FA")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("renders mobile menu button", () => {
    render(<Header locale="en" />);
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
  });

  it("opens mobile menu on toggle click", async () => {
    const user = userEvent.setup();
    render(<Header locale="en" />);

    const linksBefore = screen.getAllByRole("link");
    await user.click(screen.getByLabelText("Menu"));
    const linksAfter = screen.getAllByRole("link");

    // Mobile nav duplicates 5 nav items (victims, events, timeline, map, methodology)
    // + 1 Submit CTA = 6 additional links when open.
    expect(linksAfter.length).toBe(linksBefore.length + 6);
  });

  it("closes mobile menu on second toggle click", async () => {
    const user = userEvent.setup();
    render(<Header locale="en" />);

    const initial = screen.getAllByRole("link").length;
    const menuBtn = screen.getByLabelText("Menu");

    await user.click(menuBtn); // open
    await user.click(menuBtn); // close

    expect(screen.getAllByRole("link")).toHaveLength(initial);
  });
});
