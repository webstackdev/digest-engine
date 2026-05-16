// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ISolutionProps } from "@/lib/types";

import Solution from "./Solution";

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

const stepImage = {
  src: "/solution-step.jpg",
  width: 90,
  height: 90,
};

const solutionProps: ISolutionProps = {
  title: "A system designed to learn what you favor",
  description: "A short description of the project-scoped pipeline.",
  steps: [
    { title: "Connect sources", description: "Step one.", image: stepImage },
    { title: "Define taste", description: "Step two.", image: stepImage },
    { title: "Run pipeline", description: "Step three.", image: stepImage },
    { title: "Curate output", description: "Step four.", image: stepImage },
  ],
};

describe("Solution", () => {
  it("renders the solution overview and step images", () => {
    render(<Solution {...solutionProps} />);

    const stepList = screen.getByRole("list", { name: "How Digest Engine works" });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: solutionProps.title,
      }),
    ).toBeInTheDocument();
    expect(within(stepList).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });
});
