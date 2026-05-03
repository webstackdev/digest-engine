"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { NewsletterDraft } from "@/lib/types"
import { cn } from "@/lib/utils"

type DraftEditorProps = {
  /** Numeric project identifier used by the route handlers. */
  projectId: number
  /** Redirect target reused by the draft route handlers for non-JS fallbacks. */
  currentPageHref: string
  /** Fully expanded draft tree shown in the editor. */
  draft: NewsletterDraft
}

type JsonDraftActionResponse = {
  message?: string
}

function appendJsonMode(route: string) {
  const url = new URL(route, window.location.href)
  url.searchParams.set("mode", "json")
  return url.toString()
}

/**
 * Render the interactive newsletter draft editor.
 *
 * The editor saves through the local App Router route handlers in `mode=json`, so
 * inline edits, deletions, and reorder actions complete with a lightweight refresh
 * rather than a full-page navigation. The same form actions remain present in the
 * markup for progressive enhancement when JavaScript is unavailable.
 */
export function DraftEditor({
  projectId,
  currentPageHref,
  draft,
}: DraftEditorProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function submitJsonAction(
    actionKey: string,
    route: string,
    formData: FormData,
    fallbackError: string,
  ) {
    setPendingAction(actionKey)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(appendJsonMode(route), {
        method: "POST",
        body: formData,
      })
      const payload =
        ((await response.json()) as JsonDraftActionResponse | null) ?? null

      if (!response.ok || !payload?.message) {
        throw new Error(payload?.message || fallbackError)
      }

      setStatusMessage(payload.message)
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : fallbackError)
    } finally {
      setPendingAction(null)
    }
  }

  async function handleFormSubmit(
    event: FormEvent<HTMLFormElement>,
    actionKey: string,
    route: string,
    fallbackError: string,
  ) {
    event.preventDefault()
    await submitJsonAction(
      actionKey,
      route,
      new FormData(event.currentTarget),
      fallbackError,
    )
  }

  async function handleIntentAction(
    actionKey: string,
    route: string,
    fields: Record<string, string>,
    fallbackError: string,
  ) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value)
    }
    await submitJsonAction(actionKey, route, formData, fallbackError)
  }

  function isPending(actionKey: string) {
    return pendingAction === actionKey
  }

  function actionVariant(actionKey: string) {
    return isPending(actionKey) ? "default" : "outline"
  }

  const draftRoute = `/api/projects/${projectId}/drafts/${draft.id}`
  const regenerateRoute = `${draftRoute}/regenerate-section`

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <div className="space-y-4">
        {statusMessage ? (
          <Alert className="rounded-panel border-border/12 bg-muted/60" role="status">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert
            className="rounded-panel border-destructive/20 bg-destructive/14"
            role="alert"
            variant="destructive"
          >
            <AlertDescription className="text-destructive">
              {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
          <CardContent className="pt-5">
            <form
              action={draftRoute}
              className="grid gap-4"
              method="POST"
              onSubmit={(event) => {
                void handleFormSubmit(
                  event,
                  `draft-save-${draft.id}`,
                  draftRoute,
                  "Unable to save newsletter draft.",
                )
              }}
            >
              <input type="hidden" name="redirectTo" value={currentPageHref} />
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  className="h-11 rounded-2xl border-border/12 bg-muted/70 px-4"
                  defaultValue={draft.title}
                  id="title"
                  name="title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="target_publish_date">Target publish date</Label>
                <Input
                  className="h-11 rounded-2xl border-border/12 bg-muted/70 px-4"
                  defaultValue={draft.target_publish_date || ""}
                  id="target_publish_date"
                  name="target_publish_date"
                  type="date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="intro">Intro</Label>
                <Textarea
                  className="min-h-36 rounded-2xl border-border/12 bg-muted/70 px-4 py-3"
                  defaultValue={draft.intro}
                  id="intro"
                  name="intro"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="outro">Outro</Label>
                <Textarea
                  className="min-h-28 rounded-2xl border-border/12 bg-muted/70 px-4 py-3"
                  defaultValue={draft.outro}
                  id="outro"
                  name="outro"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button className="rounded-full" disabled={isPending(`draft-save-${draft.id}`)} size="lg" type="submit">
                  {isPending(`draft-save-${draft.id}`)
                    ? "Saving framing..."
                    : "Save draft framing"}
                </Button>
                <span className="text-sm leading-6 text-muted">
                  Coherence suggestions: {draft.generation_metadata.coherence_suggestions?.length || 0}
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        {draft.sections.map((section, sectionIndex) => {
          const sectionRoute = `/api/projects/${projectId}/draft-sections/${section.id}`
          const previousSection = draft.sections[sectionIndex - 1]
          const nextSection = draft.sections[sectionIndex + 1]

          return (
            <Card key={section.id} className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
              <CardContent className="pt-5">
                <form
                  action={sectionRoute}
                  className="grid gap-4"
                  method="POST"
                  onSubmit={(event) => {
                    void handleFormSubmit(
                      event,
                      `section-save-${section.id}`,
                      sectionRoute,
                      "Unable to save draft section.",
                    )
                  }}
                >
                  <input type="hidden" name="redirectTo" value={currentPageHref} />
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="grid gap-2">
                        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
                          Section {section.order + 1}
                        </p>
                        <Label className="sr-only" htmlFor={`section-title-${section.id}`}>Section title</Label>
                        <Input
                          className="h-11 rounded-2xl border-border/12 bg-muted/70 px-4 font-display text-title-md font-bold"
                          defaultValue={section.title}
                          id={`section-title-${section.id}`}
                          name="title"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="sr-only" htmlFor={`section-lede-${section.id}`}>Section lede</Label>
                        <Textarea
                          className="min-h-28 rounded-2xl border-border/12 bg-muted/70 px-4 py-3 text-sm leading-6"
                          defaultValue={section.lede}
                          id={`section-lede-${section.id}`}
                          name="lede"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
                      <Button
                        className="rounded-full"
                        disabled={!previousSection || isPending(`section-up-${section.id}`)}
                        onClick={() => {
                          if (!previousSection) {
                            return
                          }
                          void handleIntentAction(
                            `section-up-${section.id}`,
                            sectionRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "move_up",
                              currentOrder: String(section.order),
                              targetOrder: String(previousSection.order),
                              swapWithId: String(previousSection.id),
                            },
                            "Unable to reorder draft section.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant={actionVariant(`section-up-${section.id}`)}
                      >
                        Move up
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={!nextSection || isPending(`section-down-${section.id}`)}
                        onClick={() => {
                          if (!nextSection) {
                            return
                          }
                          void handleIntentAction(
                            `section-down-${section.id}`,
                            sectionRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "move_down",
                              currentOrder: String(section.order),
                              targetOrder: String(nextSection.order),
                              swapWithId: String(nextSection.id),
                            },
                            "Unable to reorder draft section.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant={actionVariant(`section-down-${section.id}`)}
                      >
                        Move down
                      </Button>
                      <Button className="rounded-full" disabled={isPending(`section-save-${section.id}`)} size="lg" type="submit">
                        {isPending(`section-save-${section.id}`)
                          ? "Saving section..."
                          : "Save section"}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isPending(`section-regenerate-${section.id}`)}
                        onClick={() => {
                          void handleIntentAction(
                            `section-regenerate-${section.id}`,
                            regenerateRoute,
                            {
                              redirectTo: currentPageHref,
                              sectionId: String(section.id),
                            },
                            "Unable to regenerate draft section.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant={actionVariant(`section-regenerate-${section.id}`)}
                      >
                        {isPending(`section-regenerate-${section.id}`)
                          ? "Regenerating..."
                          : "Regenerate section"}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isPending(`section-delete-${section.id}`)}
                        onClick={() => {
                          void handleIntentAction(
                            `section-delete-${section.id}`,
                            sectionRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "delete",
                            },
                            "Unable to remove draft section.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant="destructive"
                      >
                        Remove section
                      </Button>
                    </div>
                  </div>
                </form>

                {section.theme_suggestion_detail ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                    <Link
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
                      href={`/themes?project=${projectId}`}
                    >
                      {section.theme_suggestion_detail.title}
                    </Link>
                    <span>{section.theme_suggestion_detail.why_it_matters}</span>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {section.items.map((item, itemIndex) => {
                    const itemRoute = `/api/projects/${projectId}/draft-items/${item.id}`
                    const previousItem = section.items[itemIndex - 1]
                    const nextItem = section.items[itemIndex + 1]

                    return (
                      <form
                        action={itemRoute}
                        className="rounded-panel bg-muted/60 px-4 py-4"
                        key={item.id}
                        method="POST"
                        onSubmit={(event) => {
                          void handleFormSubmit(
                            event,
                            `item-save-${item.id}`,
                            itemRoute,
                            "Unable to save draft item.",
                          )
                        }}
                      >
                        <input type="hidden" name="redirectTo" value={currentPageHref} />
                        <div className="flex flex-wrap items-center gap-3">
                          <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`/content/${item.content_detail.id}?project=${projectId}`}>
                            {item.content_detail.title}
                          </Link>
                          <span className="text-sm text-muted">{item.content_detail.source_plugin}</span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <Label htmlFor={`item-summary-${item.id}`}>Summary</Label>
                          <Textarea
                            className="min-h-24 rounded-2xl border-border/12 bg-card/80 px-4 py-3 text-sm leading-6"
                            defaultValue={item.summary_used}
                            id={`item-summary-${item.id}`}
                            name="summary_used"
                          />
                        </div>
                        <div className="mt-3 grid gap-2">
                          <Label htmlFor={`item-why-${item.id}`}>Why it matters</Label>
                          <Textarea
                            className="min-h-24 rounded-2xl border-border/12 bg-card/80 px-4 py-3 text-sm leading-6"
                            defaultValue={item.why_it_matters}
                            id={`item-why-${item.id}`}
                            name="why_it_matters"
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            className="rounded-full"
                            disabled={!previousItem || isPending(`item-up-${item.id}`)}
                            onClick={() => {
                              if (!previousItem) {
                                return
                              }
                              void handleIntentAction(
                                `item-up-${item.id}`,
                                itemRoute,
                                {
                                  redirectTo: currentPageHref,
                                  intent: "move_up",
                                  currentOrder: String(item.order),
                                  targetOrder: String(previousItem.order),
                                  swapWithId: String(previousItem.id),
                                },
                                "Unable to reorder draft item.",
                              )
                            }}
                            size="lg"
                            type="button"
                            variant={actionVariant(`item-up-${item.id}`)}
                          >
                            Move up
                          </Button>
                          <Button
                            className="rounded-full"
                            disabled={!nextItem || isPending(`item-down-${item.id}`)}
                            onClick={() => {
                              if (!nextItem) {
                                return
                              }
                              void handleIntentAction(
                                `item-down-${item.id}`,
                                itemRoute,
                                {
                                  redirectTo: currentPageHref,
                                  intent: "move_down",
                                  currentOrder: String(item.order),
                                  targetOrder: String(nextItem.order),
                                  swapWithId: String(nextItem.id),
                                },
                                "Unable to reorder draft item.",
                              )
                            }}
                            size="lg"
                            type="button"
                            variant={actionVariant(`item-down-${item.id}`)}
                          >
                            Move down
                          </Button>
                          <Button className="rounded-full" disabled={isPending(`item-save-${item.id}`)} size="lg" type="submit">
                            {isPending(`item-save-${item.id}`)
                              ? "Saving item..."
                              : "Save item"}
                          </Button>
                          <Button
                            className="rounded-full"
                            disabled={isPending(`item-delete-${item.id}`)}
                            onClick={() => {
                              void handleIntentAction(
                                `item-delete-${item.id}`,
                                itemRoute,
                                {
                                  redirectTo: currentPageHref,
                                  intent: "delete",
                                },
                                "Unable to remove draft item.",
                              )
                            }}
                            size="lg"
                            type="button"
                            variant="destructive"
                          >
                            Remove item
                          </Button>
                        </div>
                      </form>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <aside className="space-y-4">
        <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
          <CardContent className="pt-5">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original pieces</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Use the move buttons with keyboard focus to reorder sections, items, and original pieces without leaving the page.
            </p>
            <div className="mt-4 space-y-4">
              {draft.original_pieces.map((piece, pieceIndex) => {
                const pieceRoute = `/api/projects/${projectId}/draft-original-pieces/${piece.id}`
                const previousPiece = draft.original_pieces[pieceIndex - 1]
                const nextPiece = draft.original_pieces[pieceIndex + 1]

                return (
                  <form
                    action={pieceRoute}
                    className="rounded-panel bg-muted/60 px-4 py-4"
                    key={piece.id}
                    method="POST"
                    onSubmit={(event) => {
                      void handleFormSubmit(
                        event,
                        `piece-save-${piece.id}`,
                        pieceRoute,
                        "Unable to save original piece.",
                      )
                    }}
                  >
                    <input type="hidden" name="redirectTo" value={currentPageHref} />
                    <div className="grid gap-2">
                      <Label htmlFor={`piece-title-${piece.id}`}>Original piece title</Label>
                      <Input
                        className="h-11 rounded-2xl border-border/12 bg-card/80 px-4 font-medium"
                        defaultValue={piece.title}
                        id={`piece-title-${piece.id}`}
                        name="title"
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Label htmlFor={`piece-pitch-${piece.id}`}>Pitch</Label>
                      <Textarea
                        className="min-h-24 rounded-2xl border-border/12 bg-card/80 px-4 py-3 text-sm leading-6"
                        defaultValue={piece.pitch}
                        id={`piece-pitch-${piece.id}`}
                        name="pitch"
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Label htmlFor={`piece-outline-${piece.id}`}>Suggested outline</Label>
                      <Textarea
                        className="min-h-28 rounded-2xl border-border/12 bg-card/80 px-4 py-3 text-sm leading-6"
                        defaultValue={piece.suggested_outline}
                        id={`piece-outline-${piece.id}`}
                        name="suggested_outline"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        className="rounded-full"
                        disabled={!previousPiece || isPending(`piece-up-${piece.id}`)}
                        onClick={() => {
                          if (!previousPiece) {
                            return
                          }
                          void handleIntentAction(
                            `piece-up-${piece.id}`,
                            pieceRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "move_up",
                              currentOrder: String(piece.order),
                              targetOrder: String(previousPiece.order),
                              swapWithId: String(previousPiece.id),
                            },
                            "Unable to reorder original piece.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant={actionVariant(`piece-up-${piece.id}`)}
                      >
                        Move up
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={!nextPiece || isPending(`piece-down-${piece.id}`)}
                        onClick={() => {
                          if (!nextPiece) {
                            return
                          }
                          void handleIntentAction(
                            `piece-down-${piece.id}`,
                            pieceRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "move_down",
                              currentOrder: String(piece.order),
                              targetOrder: String(nextPiece.order),
                              swapWithId: String(nextPiece.id),
                            },
                            "Unable to reorder original piece.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant={actionVariant(`piece-down-${piece.id}`)}
                      >
                        Move down
                      </Button>
                      <Button className="rounded-full" disabled={isPending(`piece-save-${piece.id}`)} size="lg" type="submit">
                        {isPending(`piece-save-${piece.id}`)
                          ? "Saving original piece..."
                          : "Save original piece"}
                      </Button>
                      <Button
                        className="rounded-full"
                        disabled={isPending(`piece-delete-${piece.id}`)}
                        onClick={() => {
                          void handleIntentAction(
                            `piece-delete-${piece.id}`,
                            pieceRoute,
                            {
                              redirectTo: currentPageHref,
                              intent: "delete",
                            },
                            "Unable to remove original piece.",
                          )
                        }}
                        size="lg"
                        type="button"
                        variant="destructive"
                      >
                        Remove original piece
                      </Button>
                    </div>
                  </form>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {draft.generation_metadata.error ? (
          <Card className="rounded-3xl border border-destructive/20 bg-destructive/14 shadow-panel backdrop-blur-xl">
            <CardContent className="pt-5">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-destructive">Generation error</p>
              <p className="mt-3 text-sm leading-6 text-destructive">{draft.generation_metadata.error}</p>
            </CardContent>
          </Card>
        ) : null}

        {draft.generation_metadata.models ? (
          <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
            <CardContent className="pt-5">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Models used</p>
              <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
                {Object.entries(draft.generation_metadata.models).map(([key, value]) => (
                  <p className="m-0" key={key}>
                    <span className="font-medium text-foreground">{key}</span>: {value}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </section>
  )
}
