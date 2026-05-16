import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TourPage from "./page";

describe("TourPage", () => {
  it("renders the tour route with workflow and capabilities sections", () => {
    const markup = renderToStaticMarkup(<TourPage />);

    expect(markup).toContain("Product tour");
    expect(markup).toContain("Three stages from source intake to finished output.");
    expect(markup).toContain("Project-aware ranking");
    expect(markup).toContain('href="/signup"');
    expect(markup).toContain('href="/docs/reference/overview"');
  });
});
