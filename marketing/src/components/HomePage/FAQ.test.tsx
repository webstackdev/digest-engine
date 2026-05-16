// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePageFaqProps } from "@/lib/props";

import FAQ from "./FAQ";

describe("FAQ", () => {
  it("renders a details-based FAQ section with the expected number of items", () => {
    const { container } = render(<FAQ {...HomePageFaqProps} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: HomePageFaqProps.title,
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(
      HomePageFaqProps.items.length,
    );
    expect(
      screen.getByText("Is this just ChatGPT wrapped in a UI?"),
    ).toBeInTheDocument();
    expect(screen.getByText("License?")).toBeInTheDocument();
  });
});