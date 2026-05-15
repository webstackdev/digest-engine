import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateStaticParamsFor, mockImportPage } = vi.hoisted(() => ({
  mockGenerateStaticParamsFor: vi.fn(),
  mockImportPage: vi.fn(),
}));

vi.mock("nextra/pages", () => ({
  generateStaticParamsFor: mockGenerateStaticParamsFor,
  importPage: mockImportPage,
}));

describe("Blog catch-all page", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGenerateStaticParamsFor.mockReset();
    mockImportPage.mockReset();
  });

  it("filters the blog root route out of catch-all static params", async () => {
    mockGenerateStaticParamsFor.mockReturnValue(
      vi.fn().mockResolvedValue([
        { mdxPath: ["docs", "reference", "overview"] },
        { mdxPath: ["blog"] },
        { mdxPath: ["blog", "some-article"] },
      ]),
    );

    const { generateStaticParams } = await import("./page");

    await expect(generateStaticParams()).resolves.toEqual([{ mdxPath: ["some-article"] }]);
  });

  it("loads the requested blog article", async () => {
    mockGenerateStaticParamsFor.mockReturnValue(vi.fn().mockResolvedValue([]));
    mockImportPage.mockResolvedValue({
      default: () => <div>Sample blog body</div>,
      metadata: {
        title: "A Sample Blog Article",
        description: "A starter post.",
        heroImage: "/hero.svg",
        publishedAt: "May 15, 2026",
      },
    });

    const { default: BlogArticlePage } = await import("./page");
    const markup = renderToStaticMarkup(
      await BlogArticlePage({ params: Promise.resolve({ mdxPath: ["some-article"] }) }),
    );

    expect(mockImportPage).toHaveBeenCalledWith(["blog", "some-article"]);
    expect(markup).toContain("A Sample Blog Article");
    expect(markup).toContain("Sample blog body");
    expect(markup).toContain("May 15, 2026");
  });
});
