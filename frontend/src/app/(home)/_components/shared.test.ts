import { describe, expect, it } from "vitest"

import { createTopicClusterDetail } from "@/lib/storybook-fixtures"

import { buildContentClusterLookup } from "./shared"

describe("buildContentClusterLookup", () => {
  it("keeps the highest-velocity cluster badge per content item", () => {
    const lowVelocityCluster = createTopicClusterDetail({
      id: 5,
      label: "Low velocity",
      velocity_score: 0.2,
    })
    const highVelocityCluster = createTopicClusterDetail({
      id: 6,
      label: "High velocity",
      velocity_score: 0.8,
      memberships: lowVelocityCluster.memberships,
    })

    const lookup = buildContentClusterLookup([lowVelocityCluster, highVelocityCluster])

    expect(lookup.get(41)).toEqual({
      clusterId: 6,
      label: "High velocity",
      velocityScore: 0.8,
    })
  })
})