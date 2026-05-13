import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Marketing home page", () => {
  it("renders the Digest Engine landing page sections", () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain("The research desk for your newsletter");
    expect(markup).toContain("Monitors the channels that actually move your issue");
    expect(markup).toContain("Why Digest Engine feels different");
    expect(markup).toContain("Pick the operating model that fits your stack");
    expect(markup).toContain("Spend the next four hours writing, not scrolling.");
  });
});