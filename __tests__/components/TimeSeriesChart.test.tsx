import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";

describe("TimeSeriesChart", () => {
  const mockData = [
    { date: "2024-01-01", count: 10 },
    { date: "2024-01-02", count: 20 },
    { date: "2024-01-03", count: 30 },
    { date: "2024-01-04", count: 15 },
    { date: "2024-01-05", count: 25 },
  ];

  describe("Empty State", () => {
    it("shows 'No data available' message when data is empty", () => {
      render(<TimeSeriesChart data={[]} locale="en" />);
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("does not render chart area when data is empty", () => {
      const { container } = render(<TimeSeriesChart data={[]} locale="en" />);
      const chartArea = container.querySelector(".h-64");
      expect(chartArea).not.toBeInTheDocument();
    });
  });

  describe("Chart Rendering", () => {
    it("renders correct number of bars", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const bars = container.querySelectorAll(".bg-gold-500");
      expect(bars).toHaveLength(5);
    });

    it("applies custom color class when provided", () => {
      const { container } = render(
        <TimeSeriesChart data={mockData} locale="en" color="bg-blue-500" />
      );
      const bars = container.querySelectorAll(".bg-blue-500");
      expect(bars).toHaveLength(5);
    });

    it("uses default gold color when no color provided", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const bars = container.querySelectorAll(".bg-gold-500");
      expect(bars).toHaveLength(5);
    });

    it("renders chart container with correct height", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const chartContainer = container.querySelector(".h-64");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Bar Heights", () => {
    it("calculates bar heights as percentage of maxCount", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const bars = container.querySelectorAll(".bg-gold-500");

      // maxCount is 30 (from mockData[2])
      // Expected heights: 10/30=33%, 20/30=67%, 30/30=100%, 15/30=50%, 25/30=83%
      const heights = Array.from(bars).map((bar) => {
        const style = (bar as HTMLElement).style.height;
        return parseFloat(style);
      });

      expect(heights[0]).toBeCloseTo(33.33, 1); // 10/30
      expect(heights[1]).toBeCloseTo(66.67, 1); // 20/30
      expect(heights[2]).toBeCloseTo(100, 1); // 30/30
      expect(heights[3]).toBeCloseTo(50, 1); // 15/30
      expect(heights[4]).toBeCloseTo(83.33, 1); // 25/30
    });

    it("handles zero maxCount gracefully", () => {
      const zeroData = [
        { date: "2024-01-01", count: 0 },
        { date: "2024-01-02", count: 0 },
      ];
      const { container } = render(<TimeSeriesChart data={zeroData} locale="en" />);
      const bars = container.querySelectorAll(".bg-gold-500");

      bars.forEach((bar) => {
        const height = parseFloat((bar as HTMLElement).style.height);
        expect(height).toBe(0);
      });
    });

    it("handles single data point correctly", () => {
      const singlePoint = [{ date: "2024-01-01", count: 50 }];
      const { container } = render(<TimeSeriesChart data={singlePoint} locale="en" />);
      const bar = container.querySelector(".bg-gold-500");

      expect(bar).toBeInTheDocument();
      const height = parseFloat((bar as HTMLElement).style.height);
      expect(height).toBe(100); // Only point, so 100%
    });
  });

  describe("Tooltips", () => {
    it("renders tooltip for each bar", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const tooltips = container.querySelectorAll(
        ".absolute.bottom-full.left-1\\/2.-translate-x-1\\/2"
      );
      expect(tooltips).toHaveLength(5);
    });

    it("displays date in tooltip", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);

      // Check if dates are rendered in tooltips
      expect(container.textContent).toContain("2024-01-01");
      expect(container.textContent).toContain("2024-01-02");
      expect(container.textContent).toContain("2024-01-03");
    });

    it("displays formatted count with 'requests' suffix in English", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);

      // formatNumber(10, "en") + " requests"
      expect(container.textContent).toContain("10 requests");
      expect(container.textContent).toContain("20 requests");
      expect(container.textContent).toContain("30 requests");
    });

    it("uses locale-specific number formatting in German", () => {
      const largeData = [{ date: "2024-01-01", count: 1234 }];
      const { container } = render(<TimeSeriesChart data={largeData} locale="de" />);

      // German uses . as thousand separator: 1.234
      expect(container.textContent).toContain("1.234");
    });

    it("tooltips are initially hidden (opacity-0)", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const tooltips = container.querySelectorAll(".opacity-0");

      // All tooltips should have opacity-0 initially
      expect(tooltips.length).toBeGreaterThan(0);
    });
  });

  describe("X-Axis Labels", () => {
    it("displays first date as first label", () => {
      render(<TimeSeriesChart data={mockData} locale="en" />);
      const labels = screen.getAllByText("2024-01-01");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("displays middle date as center label", () => {
      render(<TimeSeriesChart data={mockData} locale="en" />);
      // mockData has 5 items, middle = Math.floor(5/2) = 2 → mockData[2]
      const labels = screen.getAllByText("2024-01-03");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("displays last date as final label", () => {
      render(<TimeSeriesChart data={mockData} locale="en" />);
      const labels = screen.getAllByText("2024-01-05");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("handles single data point x-axis", () => {
      const singlePoint = [{ date: "2024-01-01", count: 10 }];
      render(<TimeSeriesChart data={singlePoint} locale="en" />);

      // With single point, first/middle/last all show same date
      const labels = screen.getAllByText("2024-01-01");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("handles two data points x-axis", () => {
      const twoPoints = [
        { date: "2024-01-01", count: 10 },
        { date: "2024-01-02", count: 20 },
      ];
      render(<TimeSeriesChart data={twoPoints} locale="en" />);

      expect(screen.getAllByText("2024-01-01").length).toBeGreaterThan(0);
      expect(screen.getAllByText("2024-01-02").length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles very large counts", () => {
      const largeData = [
        { date: "2024-01-01", count: 1000000 },
        { date: "2024-01-02", count: 500000 },
      ];
      const { container } = render(<TimeSeriesChart data={largeData} locale="en" />);

      // Should still render correctly
      expect(container.textContent).toContain("1,000,000 requests");
      expect(container.textContent).toContain("500,000 requests");
    });

    it("handles dates with varying formats", () => {
      const mixedDates = [
        { date: "2024-01-01", count: 10 },
        { date: "2024-12-31", count: 20 },
      ];
      const { container } = render(<TimeSeriesChart data={mixedDates} locale="en" />);

      expect(container.textContent).toContain("2024-01-01");
      expect(container.textContent).toContain("2024-12-31");
    });

    it("handles 30-day dataset (typical use case)", () => {
      const thirtyDays = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        count: Math.floor(Math.random() * 100),
      }));

      const { container } = render(<TimeSeriesChart data={thirtyDays} locale="en" />);
      const bars = container.querySelectorAll(".bg-gold-500");

      expect(bars).toHaveLength(30);
    });

    it("renders correctly with Farsi locale", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="fa" />);

      // Should still render without errors
      const bars = container.querySelectorAll(".rounded-t");
      expect(bars).toHaveLength(5);
    });
  });

  describe("Responsive Design", () => {
    it("applies flex-1 class to each bar for equal width distribution", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const barContainers = container.querySelectorAll(".flex-1");

      expect(barContainers.length).toBeGreaterThan(0);
    });

    it("uses items-end to align bars to bottom", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const chartArea = container.querySelector(".items-end");

      expect(chartArea).toBeInTheDocument();
    });

    it("applies gap between bars", () => {
      const { container } = render(<TimeSeriesChart data={mockData} locale="en" />);
      const chartArea = container.querySelector(".gap-1");

      expect(chartArea).toBeInTheDocument();
    });
  });
});
