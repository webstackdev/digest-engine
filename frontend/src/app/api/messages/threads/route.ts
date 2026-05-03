import { NextResponse } from "next/server"

import { createMessageThread, getMessageThreads } from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Return the current user's direct-message threads through the Next.js route boundary.
 */
export async function GET() {
  try {
    return NextResponse.json(await getMessageThreads())
  } catch (error) {
    return buildErrorResponse(error, "Unable to load message threads.")
  }
}

/**
 * Open or find a direct-message thread through the Next.js route boundary.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      recipient_user_id?: number
      opening_message?: string
    }

    if (typeof payload.recipient_user_id !== "number") {
      return NextResponse.json(
        { error: "recipient_user_id is required." },
        { status: 400 },
      )
    }

    return NextResponse.json(
      await createMessageThread({
        recipient_user_id: payload.recipient_user_id,
        opening_message: payload.opening_message,
      }),
      { status: 201 },
    )
  } catch (error) {
    return buildErrorResponse(error, "Unable to open message thread.")
  }
}