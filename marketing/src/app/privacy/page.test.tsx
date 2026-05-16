import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("renders the privacy policy route with standard SaaS sections", () => {
    const markup = renderToStaticMarkup(<PrivacyPage />);

    expect(markup).toContain("Privacy Policy");
    expect(markup).toContain("Information we collect");
    expect(markup).toContain("Your choices and rights");
    expect(markup).toContain('href="/signup"');
    expect(markup).toContain('href="/docs/reference/overview"');
  });
});
