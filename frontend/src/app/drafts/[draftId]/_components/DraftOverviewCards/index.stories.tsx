import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import type { NewsletterDraft } from "@/lib/types"

import { DraftOverviewCards } from "."

function createDraft(overrides: Partial<NewsletterDraft> = {}): NewsletterDraft {
  return {
    id: 8,
    project: 1,
    title: "AI Weekly: Delivery signals and more",
    intro: "A quick editor-ready summary.",
    outro: "Closing thought.",
    target_publish_date: "2026-05-08",
    status: "ready",
    generated_at: "2026-05-03T09:00:00Z",
    last_edited_at: null,
    generation_metadata: {
      source_theme_ids: [1, 2],
      source_idea_ids: [4],
      trigger_source: "manual",
      models: { section_composer: "heuristic" },
      coherence_suggestions: ["Tighten the intro transition."],
    },
    sections: [{ id: 21 } as NewsletterDraft["sections"][number]],
    original_pieces: [{ id: 31 } as NewsletterDraft["original_pieces"][number]],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

const meta = {
  title: "Pages/DraftDetail/Components/DraftOverviewCards",
  component: DraftOverviewCards,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    draft: createDraft(),
  },
} satisfies Meta<typeof DraftOverviewCards>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}