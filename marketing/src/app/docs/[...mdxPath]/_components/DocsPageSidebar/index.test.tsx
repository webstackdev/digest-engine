import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocsPageSidebar } from "./index";

describe("DocsPageSidebar", () => {
  it("renders file navigation and tab controls", () => {
    const markup = renderToStaticMarkup(
      <DocsPageSidebar
        currentPath="/docs/reference/pipeline"
        navigation={[
          {
            title: "Reference",
            items: [
              { title: "Overview", href: "/docs/reference/overview" },
              { title: "Pipeline", href: "/docs/reference/pipeline" },
            ],
          },
        ]}
        toc={[
          { depth: 2, id: "how-it-works", value: "How it works" },
        ]}
      />,
    );

    expect(markup).toContain("Files");
    expect(markup).toContain("Table of Contents");
    expect(markup).toContain('href="/docs/reference/pipeline"');
  });
});
