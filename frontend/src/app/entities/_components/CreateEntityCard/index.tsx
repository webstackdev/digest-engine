import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
  EntityTypeSelect,
  inputClassName,
  textareaClassName,
} from "../shared"

type CreateEntityCardProps = {
  projectId: number
}

/** Render the create-entity form for the selected project. */
export function CreateEntityCard({ projectId }: CreateEntityCardProps) {
  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Create entity</p>
        <CardTitle className="font-display text-title-sm font-bold text-content-active">
          Add a tracked person or organization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action="/api/entities" className="space-y-4" method="POST">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="create-entity-name">Name</Label>
              <Input className={inputClassName} id="create-entity-name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-type">Type</Label>
              <EntityTypeSelect id="create-entity-type" name="type" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-entity-description">Description</Label>
            <Textarea className={textareaClassName} id="create-entity-description" name="description" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="create-entity-website-url">Website URL</Label>
              <Input className={inputClassName} id="create-entity-website-url" name="website_url" type="url" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-github-url">GitHub URL</Label>
              <Input className={inputClassName} id="create-entity-github-url" name="github_url" type="url" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-linkedin-url">LinkedIn URL</Label>
              <Input className={inputClassName} id="create-entity-linkedin-url" name="linkedin_url" type="url" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-bluesky-handle">Bluesky handle</Label>
              <Input className={inputClassName} id="create-entity-bluesky-handle" name="bluesky_handle" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-mastodon-handle">Mastodon handle</Label>
              <Input className={inputClassName} id="create-entity-mastodon-handle" name="mastodon_handle" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-entity-twitter-handle">Twitter handle</Label>
              <Input className={inputClassName} id="create-entity-twitter-handle" name="twitter_handle" />
            </div>
          </div>
          <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
            Create entity
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
