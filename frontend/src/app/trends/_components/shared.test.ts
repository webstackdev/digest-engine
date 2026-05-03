import { describe, expect, it } from "vitest"

import { createTopicClusterDetail } from "@/lib/storybook-fixtures"

import { buildVelocityTrendPoints } from "./shared"

describe("buildVelocityTrendPoints", () => {
  it("returns a sparkline across ordered velocity snapshots", () => {
    expect(buildVelocityTrendPoints(createTopicClusterDetail().velocity_history)).toBe(
      "0.0,46.1 73.3,37.1 146.7,28.2 220.0,18.6",
    )
  })
})