import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

import { useRouter, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { locales, localeNames, localeAbbreviations } from "@/i18n/config";

const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockReplace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRouter.mockReturnValue({ replace: mockReplace } as any);
  mockUsePathname.mockReturnValue("/victims");
});

describe("LanguageSwitcher", () => {
  it("renders one <option> per configured locale", () => {
    render(<LanguageSwitcher locale="en" />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(locales.length);
  });

  it("shows compact ISO 639-1 abbreviation as option text", () => {
    render(<LanguageSwitcher locale="en" />);
    // Visible label is the abbreviation (EN/FA/DE/...), per config.
    for (const l of locales) {
      const label = localeAbbreviations[l];
      const matches = screen.getAllByRole("option", { name: label });
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it("uses native language name as title for hover hint", () => {
    render(<LanguageSwitcher locale="en" />);
    for (const l of locales) {
      const opt = screen.getByRole("option", {
        name: localeAbbreviations[l],
      }) as HTMLOptionElement;
      expect(opt.title).toBe(localeNames[l]);
    }
  });

  it("shows current locale as selected", () => {
    render(<LanguageSwitcher locale="en" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("en");
  });

  it("calls router.replace on locale change", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher locale="en" />);
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "de");
    expect(mockReplace).toHaveBeenCalledWith("/victims", { locale: "de" });
  });

  it("passes current pathname to router.replace", async () => {
    mockUsePathname.mockReturnValue("/timeline");
    const user = userEvent.setup();
    render(<LanguageSwitcher locale="en" />);
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "fa");
    expect(mockReplace).toHaveBeenCalledWith("/timeline", { locale: "fa" });
  });
});
