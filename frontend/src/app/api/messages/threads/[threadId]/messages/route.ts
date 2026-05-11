import { NextResponse } from "next/server"

import { createThreadMessage, getThreadMessages } from "@/lib/api"

function buildErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message }, { status: 400 })
}

async function parseThreadId(context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params
  const parsedThreadId = Number.parseInt(threadId, 10)

  if (Number.isNaN(parsedThreadId)) {
    throw new Error("threadId must be a number.")
  }

  return parsedThreadId
}

/**
 * Return one thread's message history through the Next.js route boundary.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  void request

  try {
    return NextResponse.json(await getThreadMessages(await parseThreadId(context)))
  } catch (error) {
    return buildErrorResponse(error, "Unable to load message history.")
  }
}

/**
 * Send one direct message through the Next.js route boundary.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const payload = (await request.json()) as { body?: string }
    if (typeof payload.body !== "string" || payload.body.trim().length === 0) {
      return NextResponse.json(
        { error: "body is required." },
        { status: 400 },
      )
    }

    return NextResponse.json(
      await createThreadMessage(await parseThreadId(context), {
        body: payload.body,
      }),
      { status: 201 },
    )
  } catch (error) {
    return buildErrorResponse(error, "Unable to send message.")
  }
}
