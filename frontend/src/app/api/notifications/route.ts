import { NextResponse } from "next/server"

import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Return the current user's notifications through the Next.js route boundary.
 *
 * @param request - Incoming request containing optional unread filter params.
 * @returns JSON notifications payload from the backend API.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  try {
    return NextResponse.json(
      await getNotifications({
        unread: searchParams.get("unread") === "true",
      }),
    )
  } catch (error) {
    return buildErrorResponse(error, "Unable to load notifications.")
  }
}

/**
 * Proxy notification read mutations through the Next.js route boundary.
 *
 * @param request - Incoming JSON request describing the desired mutation.
 * @returns JSON mutation payload from the backend API.
 */
export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as
      | { action?: "read"; notification_id?: number }
      | { action?: "read_all" }

    if (payload.action === "read") {
      if (typeof payload.notification_id !== "number") {
        return NextResponse.json(
          { error: "notification_id is required when action is read." },
          { status: 400 },
        )
      }
      return NextResponse.json(await readNotification(payload.notification_id))
    }

    if (payload.action === "read_all") {
      return NextResponse.json(await readAllNotifications())
    }

    return NextResponse.json(
      { error: "Unsupported notification action." },
      { status: 400 },
    )
  } catch (error) {
    return buildErrorResponse(error, "Unable to update notifications.")
  }
}