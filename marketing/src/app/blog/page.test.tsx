import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPageMap } = vi.hoisted(() => ({
  mockGetPageMap: vi.fn(),
}));

vi.mock("nextra/page-map", () => ({
  getPageMap: mockGetPageMap,
}));

describe("Blog home page", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetPageMap.mockReset();
  });

  it("renders article cards from the blog page map", async () => {
    mockGetPageMap.mockResolvedValue([
      {
        name: "index",
        route: "/blog",
        frontMatter: {
          title: "Blog",
        },
      },
      {
        name: "some-article",
        route: "/blog/some-article",
        frontMatter: {
          title: "A Sample Blog Article",
          description: "A starter post.",
          publishedAt: "May 15, 2026",
        },
      },
    ]);

    const { default: BlogHomePage } = await import("./page");
    const markup = renderToStaticMarkup(await BlogHomePage());

    expect(mockGetPageMap).toHaveBeenCalledWith("/blog");
    expect(markup).toContain("A Sample Blog Article");
    expect(markup).toContain('href="/blog/some-article"');
    expect(markup).toContain("Read article");
  });
});
