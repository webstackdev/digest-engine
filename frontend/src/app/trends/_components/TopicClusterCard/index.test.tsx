import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createTopicCluster } from "@/lib/storybook-fixtures"

import { TopicClusterCard } from "."

describe("TopicClusterCard", () => {
  it("renders the cluster link and summary details", () => {
    const cluster = createTopicCluster()

    render(
      <TopicClusterCard cluster={cluster} href="/trends?project=1&cluster=5" isSelected />,
    )

    expect(screen.getByRole("link", { name: /Platform Signals/i })).toHaveAttribute(
      "href",
      "/trends?project=1&cluster=5",
    )
    expect(screen.getByText(`${cluster.member_count} members`)).toBeInTheDocument()
  })
})