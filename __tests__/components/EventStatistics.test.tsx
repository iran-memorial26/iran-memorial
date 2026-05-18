import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { EventStatistics } from "@/components/EventStatistics";
import type { EventStatistics as EventStatsData } from "@/lib/queries";

const fullStats: EventStatsData = {
  totalVictims: 1500,
  verifiedCount: 1200,
  provincesAffected: 12,
  deathsByProvince: [
    { label: "Tehran", count: 500 },
    { label: "Isfahan", count: 300 },
    { label: "Shiraz", count: 200 },
  ],
  deathsByCause: [
    { label: "execution", count: 900 },
    { label: "shooting", count: 400 },
  ],
  ageDistribution: [
    { label: "Under 18", count: 100 },
    { label: "18-25", count: 500 },
    { label: "26-35", count: 400 },
  ],
  genderBreakdown: [
    { label: "male", count: 1100 },
    { label: "female", count: 300 },
    { label: "unknown", count: 100 },
  ],
};

const emptyStats: EventStatsData = {
  totalVictims: 15,
  verifiedCount: 10,
  provincesAffected: 0,
  deathsByProvince: [],
  deathsByCause: [],
  ageDistribution: [],
  genderBreakdown: [],
};

describe("EventStatistics", () => {
  it("renders section heading", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("statistics")).toBeInTheDocument();
  });

  it("renders three summary cards", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("totalVictims")).toBeInTheDocument();
    expect(screen.getByText("provincesAffected")).toBeInTheDocument();
    expect(screen.getByText("verifiedRecords")).toBeInTheDocument();
  });

  it("displays formatted numbers in summary cards", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
  });

  it("renders province bars when data exists", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("deathsByProvince")).toBeInTheDocument();
    expect(screen.getByText("Tehran")).toBeInTheDocument();
    expect(screen.getByText("Isfahan")).toBeInTheDocument();
  });

  it("renders cause of death bars when data exists", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("causeOfDeath")).toBeInTheDocument();
  });

  it("renders age distribution when data exists", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("ageDistribution")).toBeInTheDocument();
    expect(screen.getByText(/withKnownAge/)).toBeInTheDocument();
  });

  it("renders gender breakdown when data exists", () => {
    render(<EventStatistics statistics={fullStats} locale="en" />);
    expect(screen.getByText("genderBreakdown")).toBeInTheDocument();
    expect(screen.getByText("male")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("hides chart sections when data arrays are empty", () => {
    render(<EventStatistics statistics={emptyStats} locale="en" />);
    expect(screen.queryByText("deathsByProvince")).toBeNull();
    expect(screen.queryByText("causeOfDeath")).toBeNull();
    expect(screen.queryByText("ageDistribution")).toBeNull();
    expect(screen.queryByText("genderBreakdown")).toBeNull();
  });

  it("still shows summary cards when chart data is empty", () => {
    render(<EventStatistics statistics={emptyStats} locale="en" />);
    expect(screen.getByText("totalVictims")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders correctly with fa locale", () => {
    render(<EventStatistics statistics={fullStats} locale="fa" />);
    // Farsi number formatting
    expect(screen.getByText("۱٬۵۰۰")).toBeInTheDocument();
    expect(screen.getByText("۱٬۲۰۰")).toBeInTheDocument();
  });
});
