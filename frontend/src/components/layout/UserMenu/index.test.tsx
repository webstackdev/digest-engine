import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UserMenu } from "@/components/layout/UserMenu"
import { QueryProvider } from "@/providers/QueryProvider"

const {
  fetchProfileMock,
  observedUserMenuContentProps,
  observedUserMenuTriggerProps,
  userMenuContentMock,
  userMenuTriggerMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  observedUserMenuContentProps: [] as Array<Record<string, unknown>>,
  observedUserMenuTriggerProps: [] as Array<Record<string, unknown>>,
  userMenuContentMock: vi.fn((props: Record<string, unknown>) => {
    return <div data-testid="user-menu-content" data-props={JSON.stringify(props)} />
  }),
  userMenuTriggerMock: vi.fn((props: Record<string, unknown>) => {
    return <button data-props={JSON.stringify(props)} type="button">Trigger</button>
  }),
}))

vi.mock("@/lib/profile", () => ({
  PROFILE_QUERY_KEY: ["profile"],
  fetchProfile: fetchProfileMock,
}))

vi.mock("@/components/layout/UserMenu/_components/UserMenuContent", () => ({
  UserMenuContent: (props: Record<string, unknown>) => {
    observedUserMenuContentProps.push(props)
    return userMenuContentMock(props)
  },
}))

vi.mock("@/components/layout/UserMenu/_components/UserMenuTrigger", () => ({
  UserMenuTrigger: (props: Record<string, unknown>) => {
    observedUserMenuTriggerProps.push(props)
    return userMenuTriggerMock(props)
  },
}))

function renderMenu() {
  return render(
    <QueryProvider>
      <UserMenu />
    </QueryProvider>,
  )
}

type UserMenuContentProps = {
  accountName: string
  accountEmail: string
  isAuthenticated: boolean
  avatarUrl: string | null
}

describe("UserMenu", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset()
    observedUserMenuContentProps.length = 0
    observedUserMenuTriggerProps.length = 0
    userMenuContentMock.mockClear()
    userMenuTriggerMock.mockClear()
  })

  it("passes fetched profile data into the extracted trigger and content", async () => {
    fetchProfileMock.mockResolvedValue({
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
    })

    renderMenu()

    await waitFor(() => {
      expect(
        observedUserMenuTriggerProps.some(
          (props) => props.accountName === "Taylor Swift" && props.avatarUrl === null,
        ),
      ).toBe(true)
    })

    const contentProps = observedUserMenuContentProps as UserMenuContentProps[]

    expect(
      contentProps.some(
        (props) =>
          props.accountName === "Taylor Swift" &&
          props.accountEmail === "taylor@example.com" &&
          props.isAuthenticated === true,
      ),
    ).toBe(true)
    expect(screen.getByTestId("user-menu-content")).toBeInTheDocument()
  })

  it("falls back to the guest state when the profile query fails", async () => {
    fetchProfileMock.mockRejectedValue(new Error("Unable to load profile."))

    renderMenu()

    await waitFor(() => {
      expect(fetchProfileMock).toHaveBeenCalled()
    })

    const lastContentProps = observedUserMenuContentProps.at(-1) as
      | UserMenuContentProps
      | undefined

    expect(lastContentProps).toMatchObject({
      accountEmail: "",
      accountName: "Guest user",
      isAuthenticated: false,
    })
  })
})
