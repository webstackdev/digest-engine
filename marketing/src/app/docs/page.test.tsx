import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DocsHomePage from "./page";

describe("DocsHomePage", () => {
  it("renders the custom docs landing page", () => {
    const markup = renderToStaticMarkup(<DocsHomePage />);

    expect(markup).toContain("Documentation");
    expect(markup).toContain("A dedicated docs landing page for the builders using Digest Engine.");
    expect(markup).toContain('href="/docs/user-guide/overview"');
    expect(markup).toContain('href="/docs/developer-guide/overview"');
    expect(markup).toContain('href="/docs/reference/overview"');
    expect(markup).toContain('href="/docs/admin-guide/overview"');
    expect(markup).toContain('href="/signup"');
    expect(markup).toContain('href="/"');
  });
});
