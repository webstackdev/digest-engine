import { NextResponse } from "next/server"

import { deleteCurrentUserAvatar, uploadCurrentUserAvatar } from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Upload a new avatar image for the current user.
 *
 * @param request - Multipart request containing an `avatar` file.
 * @returns JSON profile payload from the backend API.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    if (!(formData.get("avatar") instanceof File)) {
      return NextResponse.json(
        { error: "Select an avatar image to upload." },
        { status: 400 },
      )
    }

    return NextResponse.json(await uploadCurrentUserAvatar(formData))
  } catch (error) {
    return buildErrorResponse(error, "Unable to upload avatar.")
  }
}

/**
 * Remove the current user's avatar image.
 *
 * @returns JSON profile payload from the backend API.
 */
export async function DELETE() {
  try {
    return NextResponse.json(await deleteCurrentUserAvatar())
  } catch (error) {
    return buildErrorResponse(error, "Unable to remove avatar.")
  }
}