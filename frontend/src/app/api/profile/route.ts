import { NextResponse } from "next/server"

import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Return the current authenticated user's profile.
 *
 * @returns JSON profile payload from the backend API.
 */
export async function GET() {
  try {
    return NextResponse.json(await getCurrentUserProfile())
  } catch (error) {
    return buildErrorResponse(error, "Unable to load profile.")
  }
}

/**
 * Update editable fields on the current user's profile.
 *
 * @param request - Incoming JSON request containing editable profile fields.
 * @returns JSON profile payload from the backend API.
 */
export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      display_name?: string
      bio?: string
      timezone?: string
    }

    return NextResponse.json(await updateCurrentUserProfile(payload))
  } catch (error) {
    return buildErrorResponse(error, "Unable to save profile.")
  }
}