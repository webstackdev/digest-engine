"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"

import type { NewsletterDraft } from "@/lib/types"

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

  const draftRoute = `/api/projects/${projectId}/drafts/${draft.id}`
  const regenerateRoute = `${draftRoute}/regenerate-section`

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <div className="space-y-4">
        {statusMessage ? (
          <p className="rounded-panel bg-muted/60 px-4 py-3 text-sm leading-6 text-muted" role="status">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-panel bg-destructive/14 px-4 py-3 text-sm leading-6 text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
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
              <label className="text-sm font-medium text-foreground" htmlFor="title">Title</label>
              <input
                className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                defaultValue={draft.title}
                id="title"
                name="title"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="target_publish_date">Target publish date</label>
              <input
                className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                defaultValue={draft.target_publish_date || ""}
                id="target_publish_date"
                name="target_publish_date"
                type="date"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="intro">Intro</label>
              <textarea
                className="min-h-36 w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                defaultValue={draft.intro}
                id="intro"
                name="intro"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="outro">Outro</label>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                defaultValue={draft.outro}
                id="outro"
                name="outro"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending(`draft-save-${draft.id}`)}
                type="submit"
              >
                {isPending(`draft-save-${draft.id}`)
                  ? "Saving framing..."
                  : "Save draft framing"}
              </button>
              <span className="text-sm leading-6 text-muted">
                Coherence suggestions: {draft.generation_metadata.coherence_suggestions?.length || 0}
              </span>
            </div>
          </form>
        </article>

        {draft.sections.map((section, sectionIndex) => {
          const sectionRoute = `/api/projects/${projectId}/draft-sections/${section.id}`
          const previousSection = draft.sections[sectionIndex - 1]
          const nextSection = draft.sections[sectionIndex + 1]

          return (
            <article key={section.id} className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
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
                      <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Section {section.order + 1}</p>
                      <label className="sr-only" htmlFor={`section-title-${section.id}`}>Section title</label>
                      <input
                        className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 font-display text-title-md font-bold text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        defaultValue={section.title}
                        id={`section-title-${section.id}`}
                        name="title"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="sr-only" htmlFor={`section-lede-${section.id}`}>Section lede</label>
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        defaultValue={section.lede}
                        id={`section-lede-${section.id}`}
                        name="lede"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending(`section-save-${section.id}`)}
                      type="submit"
                    >
                      {isPending(`section-save-${section.id}`)
                        ? "Saving section..."
                        : "Save section"}
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      {isPending(`section-regenerate-${section.id}`)
                        ? "Regenerating..."
                        : "Regenerate section"}
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Remove section
                    </button>
                  </div>
                </div>
              </form>

              {section.theme_suggestion_detail ? (
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                  <Link
                    className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
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
                        <label className="text-sm font-medium text-foreground" htmlFor={`item-summary-${item.id}`}>Summary</label>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                          defaultValue={item.summary_used}
                          id={`item-summary-${item.id}`}
                          name="summary_used"
                        />
                      </div>
                      <div className="mt-3 grid gap-2">
                        <label className="text-sm font-medium text-foreground" htmlFor={`item-why-${item.id}`}>Why it matters</label>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                          defaultValue={item.why_it_matters}
                          id={`item-why-${item.id}`}
                          name="why_it_matters"
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                          type="button"
                        >
                          Move up
                        </button>
                        <button
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                          type="button"
                        >
                          Move down
                        </button>
                        <button
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isPending(`item-save-${item.id}`)}
                          type="submit"
                        >
                          {isPending(`item-save-${item.id}`)
                            ? "Saving item..."
                            : "Save item"}
                        </button>
                        <button
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50"
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
                          type="button"
                        >
                          Remove item
                        </button>
                      </div>
                    </form>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      <aside className="space-y-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
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
                    <label className="text-sm font-medium text-foreground" htmlFor={`piece-title-${piece.id}`}>Original piece title</label>
                    <input
                      className="w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 font-medium text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={piece.title}
                      id={`piece-title-${piece.id}`}
                      name="title"
                    />
                  </div>
                  <div className="mt-3 grid gap-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={`piece-pitch-${piece.id}`}>Pitch</label>
                    <textarea
                      className="min-h-24 w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={piece.pitch}
                      id={`piece-pitch-${piece.id}`}
                      name="pitch"
                    />
                  </div>
                  <div className="mt-3 grid gap-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={`piece-outline-${piece.id}`}>Suggested outline</label>
                    <textarea
                      className="min-h-28 w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={piece.suggested_outline}
                      id={`piece-outline-${piece.id}`}
                      name="suggested_outline"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending(`piece-save-${piece.id}`)}
                      type="submit"
                    >
                      {isPending(`piece-save-${piece.id}`)
                        ? "Saving original piece..."
                        : "Save original piece"}
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50"
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
                      type="button"
                    >
                      Remove original piece
                    </button>
                  </div>
                </form>
              )
            })}
          </div>
        </article>

        {draft.generation_metadata.error ? (
          <article className="rounded-3xl border border-destructive/20 bg-destructive/14 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-destructive">Generation error</p>
            <p className="mt-3 text-sm leading-6 text-destructive">{draft.generation_metadata.error}</p>
          </article>
        ) : null}

        {draft.generation_metadata.models ? (
          <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Models used</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
              {Object.entries(draft.generation_metadata.models).map(([key, value]) => (
                <p className="m-0" key={key}>
                  <span className="font-medium text-foreground">{key}</span>: {value}
                </p>
              ))}
            </div>
          </article>
        ) : null}
      </aside>
    </section>
  )
}
