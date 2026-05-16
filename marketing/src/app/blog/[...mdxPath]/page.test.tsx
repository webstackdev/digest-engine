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
        { mdxPath: ["blog", "authority-aware-ranking"] },
      ]),
    );

    const { generateStaticParams } = await import("./page");

    await expect(generateStaticParams()).resolves.toEqual([
      { mdxPath: ["authority-aware-ranking"] },
    ]);
  });

  it("loads the requested blog article", async () => {
    mockGenerateStaticParamsFor.mockReturnValue(vi.fn().mockResolvedValue([]));
    mockImportPage.mockResolvedValue({
      default: () => <div>Sample blog body</div>,
      metadata: {
        title: "Authority-Aware Ranking",
        description: "A real post.",
        heroImage: "/hero.svg",
        publishedAt: "May 15, 2026",
      },
    });

    const { default: BlogArticlePage } = await import("./page");
    const markup = renderToStaticMarkup(
      await BlogArticlePage({ params: Promise.resolve({ mdxPath: ["authority-aware-ranking"] }) }),
    );

    expect(mockImportPage).toHaveBeenCalledWith(["blog", "authority-aware-ranking"]);
    expect(markup).toContain("Authority-Aware Ranking");
    expect(markup).toContain("Sample blog body");
    expect(markup).toContain("May 15, 2026");
  });
});
