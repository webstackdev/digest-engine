import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "./page";

describe("TermsPage", () => {
  it("renders the terms route with standard SaaS contract sections", () => {
    const markup = renderToStaticMarkup(<TermsPage />);

    expect(markup).toContain("Terms of Service");
    expect(markup).toContain("Acceptance of these terms");
    expect(markup).toContain("Limitation of liability");
    expect(markup).toContain('href="/signup"');
    expect(markup).toContain('href="/privacy"');
  });
});
