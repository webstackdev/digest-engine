import type {
  DirectMessage,
  MessageThread,
  MessageThreadReadResponse,
} from "@/lib/types"

export const MESSAGE_THREADS_QUERY_KEY = ["message-threads"] as const

export function threadMessagesQueryKey(threadId: number) {
  return ["thread-messages", threadId] as const
}

type MessageThreadCreateRequest = {
  recipient_user_id: number
  opening_message?: string
}

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

  return fallback
}

async function parseMessagesResponse<T>(
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
 * Fetch the current user's direct-message threads through the internal Next route.
 */
export async function fetchMessageThreads(): Promise<MessageThread[]> {
  const response = await fetch("/api/messages/threads", {
    cache: "no-store",
  })

  return parseMessagesResponse<MessageThread[]>(
    response,
    "Unable to load message threads.",
  )
}

/**
 * Open or find a thread through the internal Next route.
 */
export async function openMessageThread(
  payload: MessageThreadCreateRequest,
): Promise<MessageThread> {
  const response = await fetch("/api/messages/threads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  return parseMessagesResponse<MessageThread>(
    response,
    "Unable to start a conversation.",
  )
}

/**
 * Fetch one thread's message history through the internal Next route.
 */
export async function fetchThreadMessages(
  threadId: number,
): Promise<DirectMessage[]> {
  const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
    cache: "no-store",
  })

  return parseMessagesResponse<DirectMessage[]>(
    response,
    "Unable to load message history.",
  )
}

/**
 * Send one message through the internal Next route.
 */
export async function sendThreadMessage(
  threadId: number,
  body: string,
): Promise<DirectMessage> {
  const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  })

  return parseMessagesResponse<DirectMessage>(
    response,
    "Unable to send message.",
  )
}

/**
 * Mark one thread as read through the internal Next route.
 */
export async function markMessageThreadRead(
  threadId: number,
): Promise<MessageThreadReadResponse> {
  const response = await fetch(`/api/messages/threads/${threadId}/read`, {
    method: "POST",
  })

  return parseMessagesResponse<MessageThreadReadResponse>(
    response,
    "Unable to mark thread as read.",
  )
}