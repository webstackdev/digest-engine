import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CopyButton } from "."

describe("CopyButton", () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it("copies the provided value and briefly shows copied feedback", async () => {
    render(
      <CopyButton
        copiedLabel="Invite link copied"
        label="Copy invite link"
        value="https://example.com/invite/abc123"
      />,
    )

    expect(screen.getByRole("button", { name: "Copy invite link" }).querySelector("svg")).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }))
    })

    expect(writeText).toHaveBeenCalledWith("https://example.com/invite/abc123")
    expect(screen.getByRole("button", { name: "Invite link copied" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Invite link copied" }).querySelector("svg")).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1600)
    })

    expect(
      screen.getByRole("button", { name: "Copy invite link" }),
    ).toBeInTheDocument()
  })
})
