// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IFeaturesProps } from "@/lib/types";

import Features from "./Features";

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const featureImage = {
  src: "/feature-card.jpg",
  width: 90,
  height: 90,
};

const featureProps: IFeaturesProps = {
  title: "Why Digest Engine feels different",
  description: "A short section summary.",
  items: [
    {
      title: "Feature one",
      description: "Description one.",
      image: featureImage,
      link: "/blog/feature-one",
    },
    {
      title: "Feature two",
      description: "Description two.",
      image: featureImage,
      link: "/blog/feature-two",
    },
  ],
};

describe("Features", () => {
  it("renders feature cards with images and blog links", () => {
    render(<Features {...featureProps} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    const links = screen.getAllByRole("link");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: featureProps.title,
      }),
    ).toBeInTheDocument();
    expect(headings).toHaveLength(2);
    expect(links).toHaveLength(2);
    expect(screen.getAllByRole("img", { name: "Feature illustration" })).toHaveLength(2);
    expect(screen.getAllByText("Explore capability")).toHaveLength(2);
    expect(within(headings[0].closest("article") as HTMLElement).getByText(featureProps.items[0].description)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /feature one/i })).toHaveAttribute(
      "href",
      featureProps.items[0].link,
    );
    expect(screen.getByRole("link", { name: /feature two/i })).toHaveAttribute(
      "href",
      featureProps.items[1].link,
    );
  });
});
