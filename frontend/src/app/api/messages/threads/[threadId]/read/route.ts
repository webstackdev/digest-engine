import { NextResponse } from "next/server"

import { markThreadRead } from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Mark one direct-message thread as read through the Next.js route boundary.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  void request

  try {
    const { threadId } = await context.params
    const parsedThreadId = Number.parseInt(threadId, 10)

    if (Number.isNaN(parsedThreadId)) {
      return NextResponse.json(
        { error: "threadId must be a number." },
        { status: 400 },
      )
    }

    return NextResponse.json(await markThreadRead(parsedThreadId))
  } catch (error) {
    return buildErrorResponse(error, "Unable to update thread read status.")
  }
}