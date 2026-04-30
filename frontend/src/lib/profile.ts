import type { UserProfile } from "@/lib/types"

export const PROFILE_QUERY_KEY = ["profile"] as const

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  if ("error" in payload && typeof payload.error === "string") {
    return payload.error
  }

  if ("detail" in payload && typeof payload.detail === "string") {
    return payload.detail
  }

  if ("errors" in payload && Array.isArray(payload.errors)) {
    const detail = payload.errors.find(
      (item): item is { detail?: string } =>
        Boolean(item) && typeof item === "object" && "detail" in item,
    )
    if (detail?.detail) {
      return detail.detail
    }
  }

  return fallback
}

async function parseProfileResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await response.text()
  const contentType = response.headers.get("content-type") ?? ""
  const payload = text && contentType.includes("json") ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, fallbackMessage))
  }

  return (payload ?? undefined) as T
}

/**
 * Fetch the current user's profile through the Next.js route boundary.
 *
 * @returns The current user profile.
 */
export async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch("/api/profile", { cache: "no-store" })
  return parseProfileResponse<UserProfile>(
    response,
    "Unable to load profile.",
  )
}

/**
 * Save editable profile fields through the internal route handler.
 *
 * @param payload - Editable profile fields.
 * @returns The updated profile payload.
 */
export async function saveProfile(
  payload: Partial<Pick<UserProfile, "display_name" | "bio" | "timezone">>,
): Promise<UserProfile> {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  return parseProfileResponse<UserProfile>(
    response,
    "Unable to save profile.",
  )
}

/**
 * Upload a new avatar image through the internal route handler.
 *
 * @param file - Selected avatar image.
 * @returns The updated profile payload.
 */
export async function uploadProfileAvatar(file: File): Promise<UserProfile> {
  const formData = new FormData()
  formData.set("avatar", file)

  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    body: formData,
  })

  return parseProfileResponse<UserProfile>(
    response,
    "Unable to upload avatar.",
  )
}

/**
 * Remove the current avatar through the internal route handler.
 *
 * @returns The updated profile payload.
 */
export async function removeProfileAvatar(): Promise<UserProfile> {
  const response = await fetch("/api/profile/avatar", {
    method: "DELETE",
  })

  return parseProfileResponse<UserProfile>(
    response,
    "Unable to remove avatar.",
  )
}