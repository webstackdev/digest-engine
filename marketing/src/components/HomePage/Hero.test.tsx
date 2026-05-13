import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroProps } from "@/lib/props";

import Hero from "./Hero";

describe("Hero", () => {
  it("renders the updated newsletter research hero", () => {
    const markup = renderToStaticMarkup(<Hero {...HeroProps} />);

    expect(markup).toContain("The research desk for your newsletter");
    expect(markup).toContain("Digest Engine reads thousands of blogs, peer newsletters, and social feeds.");
    expect(markup).toContain("Start Your First Project");
    expect(markup).toContain('href="/signup"');
    expect(markup).toContain('alt="Digest Engine product illustration"');
  });
});