// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
});

describe("ThemeToggle", () => {
  it("switches between the light and dark document themes", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<ThemeToggle />);
    });

    const darkToggle = container.querySelector('button[aria-label="Switch to dark theme"]');

    expect(darkToggle).not.toBeNull();

    await act(async () => {
      darkToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("marketing-theme")).toBe("dark");
    expect(container.querySelector('button[aria-label="Switch to light theme"]')).not.toBeNull();

    const lightToggle = container.querySelector('button[aria-label="Switch to light theme"]');

    await act(async () => {
      lightToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("marketing-theme")).toBe("light");
    expect(container.querySelector('button[aria-label="Switch to dark theme"]')).not.toBeNull();
  });

  it("prefers a stored theme over the default document theme", async () => {
    localStorage.setItem("marketing-theme", "dark");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<ThemeToggle />);
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(container.querySelector('button[aria-label="Switch to light theme"]')).not.toBeNull();
  });
});
