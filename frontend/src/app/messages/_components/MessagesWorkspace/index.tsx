"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchMessageThreads,
  fetchThreadMessages,
  markMessageThreadRead,
  MESSAGE_THREADS_QUERY_KEY,
  openMessageThread,
  sendThreadMessage,
  threadMessagesQueryKey,
} from "@/lib/messages"
import type { DirectMessage, MessageThread, ProjectMembership } from "@/lib/types"

type MessagesWorkspaceProps = {
  apiBaseUrl: string
  availableRecipients: ProjectMembership[]
  currentUserId: number
  initialThreads: MessageThread[]
  initialRecipientUserId: number | null
  initialSelectedThreadId: number | null
  initialMessages: DirectMessage[]
}

function buildMessagesWebsocketUrl(apiBaseUrl: string, threadId: number) {
  const websocketUrl = new URL(`/ws/messages/${threadId}/`, apiBaseUrl)
  websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:"
  return websocketUrl.toString()
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Waiting for the first message"
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function upsertMessage(
  currentMessages: DirectMessage[],
  incomingMessage: DirectMessage,
) {
  const remainingMessages = currentMessages.filter(
    (message) => message.id !== incomingMessage.id,
  )

  return [...remainingMessages, incomingMessage].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime()
    const rightTime = new Date(right.created_at).getTime()

    if (leftTime === rightTime) {
      return left.id - right.id
    }

    return leftTime - rightTime
  })
}

function updateThreadSummary(
  currentThreads: MessageThread[],
  incomingMessage: DirectMessage,
) {
  const matchingThread = currentThreads.find(
    (thread) => thread.id === incomingMessage.thread,
  )

  if (!matchingThread) {
    return currentThreads
  }

  const updatedThread: MessageThread = {
    ...matchingThread,
    has_unread: false,
    last_message_at: incomingMessage.created_at,
    last_message_preview: incomingMessage.body.slice(0, 140),
    last_read_at: incomingMessage.created_at,
  }

  return [
    updatedThread,
    ...currentThreads.filter((thread) => thread.id !== incomingMessage.thread),
  ]
}

function upsertThread(
  currentThreads: MessageThread[],
  incomingThread: MessageThread,
) {
  return [
    incomingThread,
    ...currentThreads.filter((thread) => thread.id !== incomingThread.id),
  ]
}

/** Render the interactive thread list, live message history, and composer. */
export function MessagesWorkspace({
  apiBaseUrl,
  availableRecipients,
  currentUserId,
  initialThreads,
  initialRecipientUserId,
  initialSelectedThreadId,
  initialMessages,
}: MessagesWorkspaceProps) {
  const queryClient = useQueryClient()
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(
    initialSelectedThreadId,
  )
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(
    initialRecipientUserId ?? availableRecipients[0]?.user ?? null,
  )
  const [openingMessage, setOpeningMessage] = useState("")
  const [draftBody, setDraftBody] = useState("")

  const threadsQuery = useQuery({
    queryKey: MESSAGE_THREADS_QUERY_KEY,
    queryFn: fetchMessageThreads,
    initialData: initialThreads,
  })
  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data])
  const activeRecipientId = useMemo(() => {
    if (availableRecipients.length === 0) {
      return null
    }

    if (
      selectedRecipientId !== null &&
      availableRecipients.some((recipient) => recipient.user === selectedRecipientId)
    ) {
      return selectedRecipientId
    }

    if (
      initialRecipientUserId !== null &&
      availableRecipients.some((recipient) => recipient.user === initialRecipientUserId)
    ) {
      return initialRecipientUserId
    }

    return availableRecipients[0].user
  }, [availableRecipients, initialRecipientUserId, selectedRecipientId])
  const activeThreadId = useMemo(() => {
    if (threads.length === 0) {
      return null
    }

    if (selectedThreadId !== null && threads.some((thread) => thread.id === selectedThreadId)) {
      return selectedThreadId
    }

    return threads[0].id
  }, [selectedThreadId, threads])
  const selectedThread = threads.find((thread) => thread.id === activeThreadId) ?? null

  const messagesQuery = useQuery({
    queryKey: threadMessagesQueryKey(activeThreadId ?? 0),
    queryFn: () => fetchThreadMessages(activeThreadId ?? 0),
    enabled: activeThreadId !== null,
    initialData:
      activeThreadId === initialSelectedThreadId ? initialMessages : undefined,
  })

  const markReadMutation = useMutation({
    mutationFn: markMessageThreadRead,
    onSuccess: (payload) => {
      queryClient.setQueryData<MessageThread[]>(
        MESSAGE_THREADS_QUERY_KEY,
        (currentThreads = []) =>
          currentThreads.map((thread) =>
            thread.id === payload.thread_id
              ? {
                  ...thread,
                  has_unread: false,
                  last_read_at: payload.last_read_at,
                }
              : thread,
          ),
      )
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: ({ body, threadId }: { body: string; threadId: number }) =>
      sendThreadMessage(threadId, body),
    onSuccess: (message) => {
      setDraftBody("")
      queryClient.setQueryData<DirectMessage[]>(
        threadMessagesQueryKey(message.thread),
        (currentMessages = []) => upsertMessage(currentMessages, message),
      )
      queryClient.setQueryData<MessageThread[]>(
        MESSAGE_THREADS_QUERY_KEY,
        (currentThreads = []) => updateThreadSummary(currentThreads, message),
      )
    },
  })

  const openThreadMutation = useMutation({
    mutationFn: ({
      openingMessage,
      recipientUserId,
    }: {
      openingMessage: string
      recipientUserId: number
    }) =>
      openMessageThread({
        recipient_user_id: recipientUserId,
        opening_message: openingMessage || undefined,
      }),
    onSuccess: (thread) => {
      setOpeningMessage("")
      queryClient.setQueryData<MessageThread[]>(
        MESSAGE_THREADS_QUERY_KEY,
        (currentThreads = []) => upsertThread(currentThreads, thread),
      )
    },
  })

  useEffect(() => {
    if (
      activeThreadId === null ||
      !selectedThread?.has_unread ||
      !messagesQuery.isSuccess
    ) {
      return
    }

    void markReadMutation.mutateAsync(activeThreadId)
  }, [activeThreadId, messagesQuery.isSuccess, markReadMutation, selectedThread?.has_unread])

  useEffect(() => {
    if (activeThreadId === null) {
      return undefined
    }

    const socket = new WebSocket(buildMessagesWebsocketUrl(apiBaseUrl, activeThreadId))
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          message?: DirectMessage
        }

        if (payload.type !== "message.created" || payload.message === undefined) {
          return
        }

        queryClient.setQueryData<DirectMessage[]>(
          threadMessagesQueryKey(activeThreadId),
          (currentMessages = []) =>
            upsertMessage(currentMessages, payload.message as DirectMessage),
        )
        queryClient.setQueryData<MessageThread[]>(
          MESSAGE_THREADS_QUERY_KEY,
          (currentThreads = []) =>
            updateThreadSummary(currentThreads, payload.message as DirectMessage),
        )

        if ((payload.message as DirectMessage).sender !== currentUserId) {
          void markReadMutation.mutateAsync(activeThreadId)
        }
      } catch {
        // Ignore malformed websocket frames and keep the thread usable.
      }
    }

    return () => {
      socket.close()
    }
  }, [activeThreadId, apiBaseUrl, currentUserId, markReadMutation, queryClient])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (activeThreadId === null || draftBody.trim().length === 0) {
      return
    }

    await sendMessageMutation.mutateAsync({
      body: draftBody.trim(),
      threadId: activeThreadId,
    })
  }

  async function handleStartConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (activeRecipientId === null) {
      return
    }

    const thread = await openThreadMutation.mutateAsync({
      openingMessage: openingMessage.trim(),
      recipientUserId: activeRecipientId,
    })

    await queryClient.fetchQuery({
      queryKey: threadMessagesQueryKey(thread.id),
      queryFn: () => fetchThreadMessages(thread.id),
    })
    setSelectedThreadId(thread.id)
  }

  const canStartConversation = activeRecipientId !== null

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="rounded-panel border-border/10 bg-card/90 py-0 shadow-none">
        <CardHeader className="border-b border-border/60 py-4">
          <CardTitle>Threads</CardTitle>
        </CardHeader>
        <CardContent className="max-h-152 space-y-3 overflow-y-auto py-4">
          <form className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4" onSubmit={(event) => void handleStartConversation(event)}>
            <div className="space-y-1">
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs text-muted-foreground">
                Pick a collaborator from this project and optionally send the opening message immediately.
              </p>
            </div>

            <label className="grid gap-1 text-sm font-medium">
              <span>Recipient</span>
              <select
                aria-label="Recipient"
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={availableRecipients.length === 0 || openThreadMutation.isPending}
                value={activeRecipientId ?? ""}
                onChange={(event) => {
                  setSelectedRecipientId(Number.parseInt(event.target.value, 10))
                }}
              >
                {availableRecipients.length === 0 ? (
                  <option value="">No project collaborators available</option>
                ) : (
                  availableRecipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.user}>
                      {recipient.display_name || recipient.username}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              <span>Opening message</span>
              <Textarea
                aria-label="Opening message"
                placeholder="Optional opening message"
                rows={3}
                value={openingMessage}
                onChange={(event) => {
                  setOpeningMessage(event.target.value)
                }}
              />
            </label>

            <Button disabled={!canStartConversation || openThreadMutation.isPending} type="submit">
              Start conversation
            </Button>
          </form>

          {threadsQuery.isError ? (
            <Alert className="rounded-xl border-destructive/20 bg-destructive/10" variant="destructive">
              <AlertDescription>Unable to load message threads.</AlertDescription>
            </Alert>
          ) : threads.length === 0 ? (
            <Alert className="rounded-panel border-border/10 bg-muted/60">
              <AlertDescription>
                No conversations yet. Start one from the project collaborators listed above.
              </AlertDescription>
            </Alert>
          ) : (
            threads.map((thread) => {
              const isSelected = thread.id === activeThreadId
              const counterpartName =
                thread.counterpart?.display_name || thread.counterpart?.username || "Unknown user"

              return (
                <button
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-primary/30 bg-primary/8"
                      : "border-border/60 bg-muted/20 hover:border-border/90 hover:bg-muted/40"
                  }`}
                  data-active={isSelected ? "true" : "false"}
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setSelectedThreadId(thread.id)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{counterpartName}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {thread.last_message_preview || "No messages yet."}
                      </p>
                    </div>
                    {thread.has_unread ? (
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatTimestamp(thread.last_message_at)}
                  </p>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card className="rounded-panel border-border/10 bg-card/90 py-0 shadow-none">
        <CardHeader className="border-b border-border/60 py-4">
          <CardTitle>
            {selectedThread?.counterpart?.display_name ||
              selectedThread?.counterpart?.username ||
              "Conversation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-4">
          {selectedThread === null ? (
            <Alert className="rounded-panel border-border/10 bg-muted/60">
              <AlertDescription>Select a thread to read and reply.</AlertDescription>
            </Alert>
          ) : messagesQuery.isError ? (
            <Alert className="rounded-xl border-destructive/20 bg-destructive/10" variant="destructive">
              <AlertDescription>Unable to load this thread.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="max-h-120 space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-muted/15 p-4">
                {(messagesQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No messages yet. Send the first reply to start the conversation.
                  </p>
                ) : (
                  (messagesQuery.data ?? []).map((message) => {
                    const isCurrentUser = message.sender === currentUserId

                    return (
                      <div
                        className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                        key={message.id}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isCurrentUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-card ring-1 ring-border/70"
                          }`}
                        >
                          {!isCurrentUser ? (
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              {message.sender_display_name}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                          <p
                            className={`mt-2 text-[11px] ${
                              isCurrentUser
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatTimestamp(message.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
                <Textarea
                  aria-label="Message body"
                  name="body"
                  placeholder="Write a reply"
                  rows={4}
                  value={draftBody}
                  onChange={(event) => {
                    setDraftBody(event.target.value)
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    New messages in this thread appear live while the conversation stays open.
                  </p>
                  <Button disabled={sendMessageMutation.isPending || draftBody.trim().length === 0} type="submit">
                    Send message
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
