import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, userEvent, within } from "storybook/test"

import { PROFILE_QUERY_KEY } from "@/lib/profile"
import { compactDocsParameters } from "@/lib/storybook-docs"
import type { UserProfile } from "@/lib/types"

import { UserMenu } from "."

const baseProfile: UserProfile = {
  id: 7,
  username: "taylor",
  email: "taylor@example.com",
  display_name: "Taylor Swift",
  avatar_url: null,
  avatar_thumbnail_url: null,
  bio: "Editor",
  timezone: "UTC",
  first_name: "Taylor",
  last_name: "Swift",
}

const meta = {
  title: "Layout/UserMenu",
  component: UserMenuStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: compactDocsParameters,
  },
  args: {
    profile: baseProfile,
  },
} satisfies Meta<typeof UserMenuStory>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open user menu" }))

    await expect(canvas.getByRole("dialog", { name: "User menu" })).toBeInTheDocument()
    await expect(canvas.getByText("Taylor Swift")).toBeInTheDocument()
  },
}

export const WithAvatar: Story = {
  args: {
    profile: {
      ...baseProfile,
      avatar_url: "https://images.example.com/avatar.jpg",
      avatar_thumbnail_url: "https://images.example.com/avatar-thumb.jpg",
    },
  },
}

function createSeededQueryClient(profile: UserProfile) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })

  queryClient.setQueryData(PROFILE_QUERY_KEY, profile)
  return queryClient
}

function UserMenuStory({ profile }: { profile: UserProfile }) {
  const queryClient = createSeededQueryClient(profile)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-48 items-start justify-end p-6">
        <UserMenu />
      </div>
    </QueryClientProvider>
  )
}
