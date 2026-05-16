import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CompliancePage from "./page";

describe("CompliancePage", () => {
  it("renders the trust center route with security topics and framework placeholders", () => {
    const markup = renderToStaticMarkup(<CompliancePage />);

    expect(markup).toContain("Trust Center");
    expect(markup).toContain("Encryption standards");
    expect(markup).toContain("SOC 2");
    expect(markup).toContain("Replace with verified status");
    expect(markup).toContain('href="/signup"');
  });
});
