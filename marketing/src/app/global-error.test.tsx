// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

import { GlobalErrorContent } from "./global-error";

afterEach(() => {
  cleanup();
});

describe("GlobalError", () => {
  it("captures the error and renders recovery actions", () => {
    const reset = vi.fn();
    const error = new Error("marketing exploded");

    render(<GlobalErrorContent error={error} reset={reset} />);

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  });

  it("retries when the user clicks the reset button", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<GlobalErrorContent error={new Error("retryable")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});