import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders the 404 message and recovery links", () => {
    const markup = renderToStaticMarkup(<NotFound />);

    expect(markup).toContain("Page not found");
    expect(markup).toContain("Digest Engine 404 illustration");
    expect(markup).toContain("Back to home");
    expect(markup).toContain("Visit the blog");
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/blog"');
    expect(markup).toContain('href="/tour"');
    expect(markup).toContain('href="/pricing"');
    expect(markup).toContain('href="/docs"');
    expect(markup).toContain('href="/signup"');
  });
});
