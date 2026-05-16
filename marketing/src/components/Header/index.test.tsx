// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Header } from "./index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="Theme toggle">Theme toggle</button>,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
  }

  container?.remove();
  root = null;
  container = null;
});

describe("Header", () => {
  it("renders the fixed navigation shell and primary links", () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('id="marketing-nav"');
    expect(markup).toContain('href="/tour"');
    expect(markup).toContain('href="/pricing"');
    expect(markup).toContain('href="/docs"');
    expect(markup).toContain('href="/login"');
    expect(markup).toContain(`alt="Digest Engine logo"`);
  });

  it("places the theme toggle between the nav links and login", () => {
    const markup = renderToStaticMarkup(<Header />);
    const docsIndex = markup.indexOf('href="/docs"');
    const themeToggleIndex = markup.indexOf('aria-label="Theme toggle"');
    const loginIndex = markup.indexOf('href="/login"');

    expect(themeToggleIndex).toBeGreaterThan(docsIndex);
    expect(themeToggleIndex).toBeLessThan(loginIndex);
  });

  it("opens the mobile navigation menu from the hamburger button", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Header />);
    });

    const menuButton = container.querySelector('button[aria-label="Open navigation menu"]');

    expect(menuButton).not.toBeNull();
    expect(container.querySelector('#mobile-navigation')).toBeNull();

    await act(async () => {
      menuButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const mobileMenu = container.querySelector('#mobile-navigation');

    expect(mobileMenu).not.toBeNull();
    expect(container.querySelector('button[aria-label="Close navigation menu"]')).not.toBeNull();
    expect(mobileMenu?.textContent).toContain("How It Works");
    expect(mobileMenu?.textContent).toContain("Login");
  });
});
