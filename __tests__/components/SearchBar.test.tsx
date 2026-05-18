import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(),
}));

// SearchBar debounces and calls /api/search on input. Stub fetch so unit
// tests do not depend on a running server.
global.fetch = vi.fn(() =>
  Promise.resolve(
    new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  )
) as unknown as typeof fetch;

import { useRouter } from "@/i18n/navigation";
import { SearchBar } from "@/components/SearchBar";

const mockUseRouter = vi.mocked(useRouter);
const mockPush = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRouter.mockReturnValue({ push: mockPush } as any);
});

describe("SearchBar", () => {
  it("renders with placeholder text", () => {
    render(<SearchBar />);
    expect(
      screen.getByPlaceholderText("searchPlaceholder")
    ).toBeInTheDocument();
  });

  it("renders with default value", () => {
    render(<SearchBar defaultValue="Mahsa" />);
    expect(screen.getByDisplayValue("Mahsa")).toBeInTheDocument();
  });

  it("navigates with encoded query on submit", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(
      screen.getByPlaceholderText("searchPlaceholder"),
      "Mahsa Amini"
    );
    await user.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledWith(
      "/victims?search=Mahsa%20Amini"
    );
  });

  it("does not navigate on empty query", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.click(screen.getByRole("button"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("trims whitespace from query", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(
      screen.getByPlaceholderText("searchPlaceholder"),
      "  Mahsa  "
    );
    await user.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledWith("/victims?search=Mahsa");
  });

  it("URL encodes special characters", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(
      screen.getByPlaceholderText("searchPlaceholder"),
      "مهسا"
    );
    await user.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalled();
    const url: string = mockPush.mock.calls[0][0];
    expect(decodeURIComponent(url)).toContain("مهسا");
  });

  it("applies large styling when large prop is true", () => {
    render(<SearchBar large />);
    const input = screen.getByPlaceholderText("searchPlaceholder");
    expect(input.className).toContain("text-lg");
  });

  it("applies default styling when large is false", () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("searchPlaceholder");
    expect(input.className).toContain("text-sm");
  });
});
