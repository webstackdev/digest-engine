import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders the 404 message and home link", () => {
    const markup = renderToStaticMarkup(<NotFound />);

    expect(markup).toContain("Page not found");
    expect(markup).toContain("Back to home");
    expect(markup).toContain('href="/"');
  });
});
