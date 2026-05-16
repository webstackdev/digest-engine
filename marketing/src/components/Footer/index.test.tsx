import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer } from "./index";

describe("Footer", () => {
  it("renders product, navigation, and legal links", () => {
    const markup = renderToStaticMarkup(<Footer />);

    expect(markup).toContain('id="marketing-footer"');
    expect(markup).toContain('href="/docs"');
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/terms"');
    expect(markup).toContain('href="/cookies"');
    expect(markup).toContain('href="/compliance"');
    expect(markup).toContain("AGPLv3");
  });
});
