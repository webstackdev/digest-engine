import { useQueryClient } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { QueryProvider } from "@/components/shared/QueryProvider"

function Inspector() {
  const queryClient = useQueryClient()
  const options = queryClient.getDefaultOptions().queries

  return (
    <div>
      <span data-testid="retry">{String(options?.retry)}</span>
      <span data-testid="refetch">
        {String(options?.refetchOnWindowFocus)}
      </span>
    </div>
  )
}

describe("QueryProvider", () => {
  it("provides the expected query defaults to descendant consumers", () => {
    render(
      <QueryProvider>
        <Inspector />
      </QueryProvider>,
    )

    expect(screen.getByTestId("retry")).toHaveTextContent("1")
    expect(screen.getByTestId("refetch")).toHaveTextContent("false")
  })
})
