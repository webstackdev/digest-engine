"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_QUERY_KEY,
} from "@/lib/notifications"
import type { Notification } from "@/lib/types"

type NotificationMenuProps = {
  /** Absolute websocket URL for the backend notifications consumer. */
  websocketUrl: string
}

function upsertNotification(
  currentNotifications: Notification[],
  incomingNotification: Notification,
) {
  const remainingNotifications = currentNotifications.filter(
    (notification) => notification.id !== incomingNotification.id,
  )
  return [incomingNotification, ...remainingNotifications]
}

/** Render the shared notification bell and persistent inbox dropdown. */
export function NotificationMenu({ websocketUrl }: NotificationMenuProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchNotifications(),
  })

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (notification) => {
      queryClient.setQueryData<Notification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (currentNotifications = []) =>
          currentNotifications.map((currentNotification) =>
            currentNotification.id === notification.id
              ? notification
              : currentNotification,
          ),
      )
    },
  })

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const readAt = new Date().toISOString()
      queryClient.setQueryData<Notification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (currentNotifications = []) =>
          currentNotifications.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: notification.read_at ?? readAt,
          })),
      )
    },
  })

  useEffect(() => {
    if (!websocketUrl) {
      return undefined
    }

    const socket = new WebSocket(websocketUrl)
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          notification?: Notification
        }
        if (
          payload.type !== "notification.created" ||
          payload.notification === undefined
        ) {
          return
        }
        queryClient.setQueryData<Notification[]>(
          NOTIFICATIONS_QUERY_KEY,
          (currentNotifications = []) =>
            upsertNotification(currentNotifications, payload.notification as Notification),
        )
      } catch {
        // Ignore malformed websocket frames and keep the inbox usable.
      }
    }

    return () => {
      socket.close()
    }
  }, [queryClient, websocketUrl])

  const notifications = notificationsQuery.data ?? []
  const unreadCount = notifications.filter(
    (notification) => !notification.is_read,
  ).length

  async function handleNotificationSelect(notification: Notification) {
    if (!notification.is_read) {
      await readMutation.mutateAsync(notification.id)
    }

    if (notification.link_path) {
      router.push(notification.link_path)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open notifications"
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/10 bg-card/85 p-0 shadow-sm transition hover:brightness-105 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <Badge
            className="absolute -right-1 -top-1 min-w-5 px-1 text-[10px]"
            variant="destructive"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-88 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notification inbox</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <button
            className="text-xs font-medium text-primary disabled:opacity-50"
            disabled={unreadCount === 0 || readAllMutation.isPending}
            type="button"
            onClick={() => {
              void readAllMutation.mutateAsync()
            }}
          >
            Mark all read
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-1">
          {notificationsQuery.isError ? (
            <div className="px-3 py-4 text-sm text-destructive">
              Unable to load notifications.
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.slice(0, 8).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="items-start gap-3 rounded-xl px-3 py-3"
                onClick={() => {
                  void handleNotificationSelect(notification)
                }}
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    notification.is_read ? "bg-border" : "bg-primary"
                  }`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 text-sm leading-5">{notification.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {notification.created_at.replace("T", " ").replace("Z", " UTC")}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
