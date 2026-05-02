import { describe, expect, it, vi } from "vitest"

const { authHandlerMock } = vi.hoisted(() => ({
  authHandlerMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  default: authHandlerMock,
}))

import { GET, POST } from "./route"

describe("/api/auth/[...nextauth] route exports", () => {
  it("re-exports the shared auth handler for both GET and POST", () => {
    expect(GET).toBe(authHandlerMock)
    expect(POST).toBe(authHandlerMock)
  })
})