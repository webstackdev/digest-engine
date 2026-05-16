import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CookiesPage from "./page";

describe("CookiesPage", () => {
  it("renders the cookies route with standard SaaS cookie policy sections", () => {
    const markup = renderToStaticMarkup(<CookiesPage />);

    expect(markup).toContain("Cookie Policy");
    expect(markup).toContain("How we use cookies");
    expect(markup).toContain("Managing cookie choices");
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/terms"');
  });
});
