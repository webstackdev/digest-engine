import type {
  Notification,
  NotificationReadAllResponse,
} from "@/lib/types"

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const

type NotificationMutationRequest =
  | {
      action: "read"
      notification_id: number
    }
  | {
      action: "read_all"
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

async function parseNotificationsResponse<T>(
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
 * Fetch the current user's notifications through the internal Next route.
 *
 * @param options - Optional unread-only filter.
 * @returns The user's notifications ordered newest first.
 */
export async function fetchNotifications(options: {
  unread?: boolean
} = {}): Promise<Notification[]> {
  const searchParams = new URLSearchParams()
  if (options.unread) {
    searchParams.set("unread", "true")
  }

  const response = await fetch(
    `/api/notifications${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    {
      cache: "no-store",
    },
  )

  return parseNotificationsResponse<Notification[]>(
    response,
    "Unable to load notifications.",
  )
}

/**
 * Mark one notification as read through the internal Next route.
 *
 * @param notificationId - Numeric notification identifier.
 * @returns The updated notification payload.
 */
export async function markNotificationRead(
  notificationId: number,
): Promise<Notification> {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "read",
      notification_id: notificationId,
    } satisfies NotificationMutationRequest),
  })

  return parseNotificationsResponse<Notification>(
    response,
    "Unable to mark notification as read.",
  )
}

/**
 * Mark all notifications as read through the internal Next route.
 *
 * @returns The count of updated notifications.
 */
export async function markAllNotificationsRead(): Promise<NotificationReadAllResponse> {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "read_all",
    } satisfies NotificationMutationRequest),
  })

  return parseNotificationsResponse<NotificationReadAllResponse>(
    response,
    "Unable to mark notifications as read.",
  )
}
