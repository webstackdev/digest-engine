// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IProblemsProps } from "@/lib/types";

import Problems from "./Problems";

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

const problemsProps: IProblemsProps = {
  eyebrow: "Editorial pain",
  title: "Finding relevant stories is harder than it looks.",
  description: "A short setup sentence for the section.",
  toolsHeading: "Where current tools fall short",
  toolsDescription: "A short explanation of the current-tool failure mode.",
  toolFailures: [
    {
      title: "Signal mismatch",
      description: "Generic popularity is not the same as niche authority.",
    },
    {
      title: "Saturation blindness",
      description: "You cannot see when the topic is already over-covered.",
    },
    {
      title: "No editorial context",
      description: "The system does not know your point of view.",
    },
  ],
};

describe("Problems", () => {
  it("renders the problem framing structure from props", () => {
    render(<Problems {...problemsProps} />);

    const gapList = screen.getByRole("list", { name: "Curation tool gaps" });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: problemsProps.title,
      }),
    ).toBeInTheDocument();
    expect(within(gapList).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
