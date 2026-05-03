import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import type { NewsletterDraft } from "@/lib/types"

import { DraftEditor } from "."

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
    sections: [
      {
        id: 21,
        draft: 8,
        theme_suggestion: 3,
        theme_suggestion_detail: {
          id: 3,
          title: "Delivery signals",
          pitch: "Pitch",
          why_it_matters: "Why it matters",
        },
        title: "Delivery signals",
        lede: "Section lede.",
        order: 0,
        items: [
          {
            id: 44,
            section: 21,
            content: 55,
            content_detail: {
              id: 55,
              url: "https://example.com/post",
              title: "Useful article",
              source_plugin: "rss",
              published_date: "2026-05-02T10:00:00Z",
            },
            summary_used: "Item summary.",
            why_it_matters: "Item why.",
            order: 0,
          },
          {
            id: 45,
            section: 21,
            content: 56,
            content_detail: {
              id: 56,
              url: "https://example.com/post-2",
              title: "Second article",
              source_plugin: "reddit",
              published_date: "2026-05-02T11:00:00Z",
            },
            summary_used: "Second summary.",
            why_it_matters: "Second why.",
            order: 1,
          },
        ],
      },
      {
        id: 22,
        draft: 8,
        theme_suggestion: null,
        theme_suggestion_detail: null,
        title: "Second section",
        lede: "Second lede.",
        order: 1,
        items: [],
      },
    ],
    original_pieces: [
      {
        id: 31,
        draft: 8,
        idea: 9,
        idea_detail: {
          id: 9,
          angle_title: "Original idea",
          summary: "Summary",
          suggested_outline: "1. Outline",
        },
        title: "Original idea",
        pitch: "Pitch",
        suggested_outline: "1. Outline",
        order: 0,
      },
      {
        id: 32,
        draft: 8,
        idea: 10,
        idea_detail: {
          id: 10,
          angle_title: "Second idea",
          summary: "Summary",
          suggested_outline: "1. Outline",
        },
        title: "Second idea",
        pitch: "Pitch",
        suggested_outline: "1. Outline",
        order: 1,
      },
    ],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

const meta = {
  title: "Pages/DraftDetail/Components/DraftEditor",
  component: DraftEditor,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    currentPageHref: "/drafts/8?project=1",
    draft: createDraft(),
    projectId: 1,
  },
} satisfies Meta<typeof DraftEditor>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithGenerationError: Story = {
  args: {
    draft: createDraft({
      generation_metadata: {
        source_theme_ids: [1, 2],
        source_idea_ids: [4],
        trigger_source: "manual",
        models: { section_composer: "heuristic" },
        coherence_suggestions: ["Tighten the intro transition."],
        error: "The section composer timed out during generation.",
      },
    }),
  },
}