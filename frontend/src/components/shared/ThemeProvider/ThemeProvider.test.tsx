import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/shared/ThemeProvider"

const nextThemesProviderMock = vi.fn()

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children, ...props }: { children: ReactNode }) => {
    nextThemesProviderMock(props)

    return <div data-testid="next-themes-provider">{children}</div>
  },
}))

describe("ThemeProvider", () => {
  afterEach(() => {
    nextThemesProviderMock.mockClear()
  })

  it("renders children and forwards theme props to next-themes", () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <span>Theme content</span>
      </ThemeProvider>,
    )

    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument()
    expect(screen.getByText("Theme content")).toBeInTheDocument()
    expect(nextThemesProviderMock).toHaveBeenCalledWith({
      attribute: "class",
      defaultTheme: "system",
      disableTransitionOnChange: true,
      enableSystem: true,
    })
  })
})