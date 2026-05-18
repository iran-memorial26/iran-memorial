import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard, Section, HorizontalBars } from "@/components/charts";

describe("StatCard", () => {
  it("renders value and label", () => {
    render(<StatCard value="1,234" label="Documented Victims" />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Documented Victims")).toBeInTheDocument();
  });

  it("applies highlight color when highlight is true", () => {
    const { container } = render(
      <StatCard value="42" label="Test" highlight />
    );
    const valueEl = container.querySelector(".text-gold-400");
    expect(valueEl).toBeInTheDocument();
    expect(valueEl!.textContent).toBe("42");
  });

  it("applies default color when highlight is false", () => {
    const { container } = render(<StatCard value="42" label="Test" />);
    const valueEl = container.querySelector(".text-memorial-100");
    expect(valueEl).toBeInTheDocument();
  });
});

describe("Section", () => {
  it("renders title and children", () => {
    render(
      <Section title="Test Section">
        <p>Child content</p>
      </Section>
    );
    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders title as h2", () => {
    render(
      <Section title="My Title">
        <span />
      </Section>
    );
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("My Title");
  });
});

describe("HorizontalBars", () => {
  const data = [
    { label: "Tehran", count: 500 },
    { label: "Isfahan", count: 300 },
    { label: "Shiraz", count: 100 },
  ];

  it("renders all bar labels", () => {
    render(<HorizontalBars data={data} locale="en" color="bg-gold-500" />);
    expect(screen.getByText("Tehran")).toBeInTheDocument();
    expect(screen.getByText("Isfahan")).toBeInTheDocument();
    expect(screen.getByText("Shiraz")).toBeInTheDocument();
  });

  it("renders formatted counts", () => {
    render(<HorizontalBars data={data} locale="en" color="bg-gold-500" />);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders bar widths proportional to max", () => {
    const { container } = render(
      <HorizontalBars data={data} locale="en" color="bg-gold-500" />
    );
    const bars = container.querySelectorAll(".bg-gold-500");
    expect(bars).toHaveLength(3);
    // First bar (500/500 = 100%)
    expect(bars[0].getAttribute("style")).toContain("100%");
    // Second bar (300/500 = 60%)
    expect(bars[1].getAttribute("style")).toContain("60%");
    // Third bar (100/500 = 20%)
    expect(bars[2].getAttribute("style")).toContain("20%");
  });

  it("handles empty data array", () => {
    const { container } = render(
      <HorizontalBars data={[]} locale="en" color="bg-gold-500" />
    );
    expect(container.querySelectorAll(".bg-gold-500")).toHaveLength(0);
  });

  it("formats numbers for fa locale", () => {
    render(
      <HorizontalBars
        data={[{ label: "Test", count: 1500 }]}
        locale="fa"
        color="bg-gold-500"
      />
    );
    expect(screen.getByText("۱٬۵۰۰")).toBeInTheDocument();
  });
});
