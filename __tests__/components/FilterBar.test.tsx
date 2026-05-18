import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/FilterBar";

const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseSearchParams = vi.mocked(useSearchParams);

const mockPush = vi.fn();

const defaultProps = {
  provinces: [
    { slug: "Tehran", name: "Tehran" },
    { slug: "Isfahan", name: "Isfahan" },
    { slug: "Shiraz", name: "Shiraz" },
  ],
  minYear: 2020,
  maxYear: 2023,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: mockPush } as any);
  mockUsePathname.mockReturnValue("/victims");
  mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
});

describe("FilterBar", () => {
  it("renders province dropdown with all options", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("allProvinces")).toBeInTheDocument();
    expect(screen.getByText("Tehran")).toBeInTheDocument();
    expect(screen.getByText("Isfahan")).toBeInTheDocument();
    expect(screen.getByText("Shiraz")).toBeInTheDocument();
  });

  it("renders year dropdown with correct range", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("allYears")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
  });

  it("renders gender buttons", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("allGenders")).toBeInTheDocument();
    expect(screen.getByText("male")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
  });

  it("updates province param via router.push", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const [provinceSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(provinceSelect, "Tehran");
    expect(mockPush).toHaveBeenCalledWith("/victims?province=Tehran");
  });

  it("updates year param via router.push", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "2022");
    expect(mockPush).toHaveBeenCalledWith("/victims?year=2022");
  });

  it("updates gender param via router.push", async () => {
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByText("male"));
    expect(mockPush).toHaveBeenCalledWith("/victims?gender=male");
  });

  it("deletes page param on filter change", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("page=3") as any
    );
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByText("female"));
    const pushArg: string = mockPush.mock.calls[0][0];
    expect(pushArg).not.toContain("page=");
    expect(pushArg).toContain("gender=female");
  });

  it("shows clear filters button when filters active", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("province=Tehran") as any
    );
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText("clearFilters")).toBeInTheDocument();
  });

  it("clears filters but keeps search on clear", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("province=Tehran&search=test&gender=male") as any
    );
    const user = userEvent.setup();
    render(<FilterBar {...defaultProps} />);
    await user.click(screen.getByText("clearFilters"));
    expect(mockPush).toHaveBeenCalledWith("/victims?search=test");
  });

  it("hides clear button when no filters active", () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.queryByText("clearFilters")).toBeNull();
  });
});
