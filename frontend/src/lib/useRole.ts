"use client"

import { useQueryClient } from "@tanstack/react-query"

import type { Project, ProjectRole } from "@/lib/types"

export const PROJECTS_QUERY_KEY = ["projects"] as const

/**
 * Read the cached role for one project from the shared projects query.
 *
 * The helper does not trigger its own fetch. It only inspects the existing
 * React Query cache so client components can gate UI without duplicating the
 * project request.
 *
 * @param projectId - Project identifier to look up in the cached project list.
 * @returns The cached role for the project, or `null` when unavailable.
 */
export function useRole(projectId: number | null): ProjectRole | null {
  const queryClient = useQueryClient()
  const projects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY)

  if (!projectId || !projects) {
    return null
  }

  return projects.find((project) => project.id === projectId)?.user_role ?? null
}
