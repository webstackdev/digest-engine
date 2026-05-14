import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Header } from "./index";

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

describe("Header", () => {
  it("renders the fixed navigation shell", () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('id="marketing-nav"');
    expect(markup).toContain("fixed");
    expect(markup).toContain("top-2");
    expect(markup).toContain("z-50");
    expect(markup).toContain("shadow-card-strong");
    expect(markup).toContain('href="/login"');
  });
});