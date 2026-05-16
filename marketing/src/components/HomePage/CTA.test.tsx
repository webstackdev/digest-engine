// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CTA } from "./CTA";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CTA", () => {
  it("renders a signup call to action with a linked primary button", () => {
    render(<CTA />);

    const region = screen.getByRole("region", {
      name: "Homepage call to action",
    });
    const primaryLink = within(region).getByRole("link");

    expect(within(region).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(primaryLink).toHaveAttribute("href", "/signup");
  });
});