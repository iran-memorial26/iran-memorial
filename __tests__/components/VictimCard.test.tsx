import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => {
  const React = require("react");
  return {
    default: (props: any) =>
      React.createElement("img", {
        src: props.src,
        alt: props.alt,
        "data-testid": "next-image",
      }),
  };
});

vi.mock("@/i18n/navigation", () => {
  const React = require("react");
  return {
    Link: ({ href, children, ...props }: any) =>
      React.createElement("a", { href, ...props }, children),
  };
});

import { VictimCard } from "@/components/VictimCard";

const baseProps = {
  slug: "amini-mahsa-2000",
  nameLatin: "Mahsa Amini",
  nameFarsi: "مهسا امینی",
  dateOfDeath: new Date("2022-09-16"),
  placeOfDeath: "Tehran",
  causeOfDeath: "Head injuries",
  photoUrl: null as string | null,
  locale: "en" as const,
};

describe("VictimCard", () => {
  it("displays nameLatin as primary name for en locale", () => {
    render(<VictimCard {...baseProps} />);
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toContain("Mahsa Amini");
  });

  it("displays nameFarsi as primary name for fa locale", () => {
    render(<VictimCard {...baseProps} locale="fa" />);
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toContain("مهسا امینی");
  });

  it("shows secondary Farsi name for non-fa locale", () => {
    const { container } = render(<VictimCard {...baseProps} />);
    const secondary = container.querySelector("p[dir='rtl']");
    expect(secondary).toBeInTheDocument();
    expect(secondary!.textContent).toBe("مهسا امینی");
  });

  it("hides secondary name for fa locale", () => {
    const { container } = render(<VictimCard {...baseProps} locale="fa" />);
    expect(container.querySelector("p[dir='rtl']")).toBeNull();
  });

  it("does not show secondary name when nameFarsi is null", () => {
    const { container } = render(
      <VictimCard {...baseProps} nameFarsi={null} />
    );
    expect(container.querySelector("p[dir='rtl']")).toBeNull();
  });

  it("links to correct victim detail page", () => {
    render(<VictimCard {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/victims/amini-mahsa-2000");
  });

  it("displays formatted date of death", () => {
    render(<VictimCard {...baseProps} />);
    expect(screen.getByText(/September/)).toBeInTheDocument();
  });

  it("displays place of death", () => {
    render(<VictimCard {...baseProps} />);
    expect(screen.getByText("Tehran")).toBeInTheDocument();
  });

  it("displays cause of death", () => {
    render(<VictimCard {...baseProps} />);
    expect(screen.getByText("Head injuries")).toBeInTheDocument();
  });

  it("renders photo when photoUrl provided", () => {
    render(
      <VictimCard {...baseProps} photoUrl="https://example.com/photo.jpg" />
    );
    const img = screen.getByTestId("next-image");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(img).toHaveAttribute("alt", "Mahsa Amini");
  });

  it("renders fallback SVG when no photoUrl", () => {
    const { container } = render(<VictimCard {...baseProps} photoUrl={null} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByTestId("next-image")).toBeNull();
  });

  it("shows verified badge when verificationStatus is verified", () => {
    render(<VictimCard {...baseProps} verificationStatus="verified" />);
    // Tooltip is localized; match by prefix to stay locale-stable.
    expect(screen.getByTitle(/^Verified/)).toBeInTheDocument();
  });

  it("does not show verified badge otherwise", () => {
    render(<VictimCard {...baseProps} verificationStatus="pending" />);
    expect(screen.queryByTitle(/^Verified/)).toBeNull();
  });

  it("shows age at death when provided", () => {
    render(<VictimCard {...baseProps} ageAtDeath={22} />);
    expect(screen.getByText("(22)")).toBeInTheDocument();
  });

  it("omits cause of death when null", () => {
    render(<VictimCard {...baseProps} causeOfDeath={null} />);
    expect(screen.queryByText("Head injuries")).toBeNull();
  });

  it("omits place of death when null", () => {
    render(<VictimCard {...baseProps} placeOfDeath={null} />);
    expect(screen.queryByText("Tehran")).toBeNull();
  });
});
