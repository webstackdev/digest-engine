import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptProjectThemeSuggestion,
  dismissProjectThemeSuggestion,
} from "@/lib/api"

import { POST as acceptTheme } from "../accept/route"
import { POST as dismissTheme } from "../dismiss/route"

vi.mock("@/lib/api", () => ({
  acceptProjectThemeSuggestion: vi.fn(),
  dismissProjectThemeSuggestion: vi.fn(),
}))

function buildRequest(formData: FormData) {
  return new Request("http://localhost/api/projects/4/themes/9/action", {
    method: "POST",
    body: formData,
  })
}

async function getLocation(response: Response) {
  return response.headers.get("location")
}

describe("theme mutation route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts a theme and redirects with a success message", async () => {
    vi.mocked(acceptProjectThemeSuggestion).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("redirectTo", "/themes?project=4&status=pending")

    const response = await acceptTheme(buildRequest(formData), {
      params: Promise.resolve({ id: "4", themeId: "9" }),
    })

    expect(acceptProjectThemeSuggestion).toHaveBeenCalledWith(4, 9)
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/themes?project=4&status=pending&message=Theme+accepted.",
    )
  })

  it("falls back to the default theme redirect when accepting fails with a non-Error", async () => {
    vi.mocked(acceptProjectThemeSuggestion).mockRejectedValue("boom")

    const response = await acceptTheme(buildRequest(new FormData()), {
      params: Promise.resolve({ id: "4", themeId: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/themes?project=4&error=Unable+to+accept+theme.",
    )
  })

  it("dismisses a theme with the provided reason and default redirect", async () => {
    vi.mocked(dismissProjectThemeSuggestion).mockResolvedValue(undefined as never)

    const formData = new FormData()
    formData.set("reason", "Already covered elsewhere")

    const response = await dismissTheme(buildRequest(formData), {
      params: Promise.resolve({ id: "4", themeId: "9" }),
    })

    expect(dismissProjectThemeSuggestion).toHaveBeenCalledWith(
      4,
      9,
      "Already covered elsewhere",
    )
    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/themes?project=4&message=Theme+dismissed.",
    )
  })

  it("redirects with the thrown error message when dismissal fails", async () => {
    vi.mocked(dismissProjectThemeSuggestion).mockRejectedValue(
      new Error("Dismiss theme failed"),
    )

    const formData = new FormData()
    formData.set("redirectTo", "/themes?project=4&status=pending")

    const response = await dismissTheme(buildRequest(formData), {
      params: Promise.resolve({ id: "4", themeId: "9" }),
    })

    expect(response.status).toBe(307)
    await expect(getLocation(response)).resolves.toBe(
      "http://localhost/themes?project=4&status=pending&error=Dismiss+theme+failed",
    )
  })
})