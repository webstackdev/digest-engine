import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ThemeToggle } from "."

const { setThemeMock, useThemeMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  useThemeMock: vi.fn(),
}))

vi.mock("next-themes", () => ({
  useTheme: useThemeMock,
}))

describe("ThemeToggle", () => {
  it("switches from dark to light mode", () => {
    useThemeMock.mockReturnValue({
      resolvedTheme: "dark",
      setTheme: setThemeMock,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button", { name: "Switch to light theme" })
    expect(button).toHaveTextContent("Dark mode")

    fireEvent.click(button)

    expect(setThemeMock).toHaveBeenCalledWith("light")
  })

  it("switches from light to dark mode", () => {
    useThemeMock.mockReturnValue({
      resolvedTheme: "light",
      setTheme: setThemeMock,
    })

    render(<ThemeToggle />)

    const button = screen.getByRole("button", { name: "Switch to dark theme" })
    expect(button).toHaveTextContent("Light mode")

    fireEvent.click(button)

    expect(setThemeMock).toHaveBeenCalledWith("dark")
  })
})