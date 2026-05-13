import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/** Render the self-service project creation form. */
export function NewProjectFormCard() {
  return (
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardHeader>
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
          Provision
        </p>
        <h2 className="font-display text-title-sm font-bold text-foreground">
          New project
        </h2>
        <CardDescription>
          Create a project, set its editorial scope, and become the first project admin automatically.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action="/api/projects" className="space-y-4" method="POST">
          <input type="hidden" name="redirectTo" value="/admin/projects/new" />

          <div className="grid gap-2">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              className="h-11 rounded-2xl border-border bg-muted px-4"
              id="new-project-name"
              name="name"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-project-topic-description">Topic description</Label>
            <Textarea
              className="min-h-32 resize-y rounded-2xl border-border bg-muted px-4 py-3"
              id="new-project-topic-description"
              name="topic_description"
              required
            />
          </div>

          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="new-project-retention-days">Content retention days</Label>
            <Input
              className="h-11 rounded-2xl border-border bg-muted px-4"
              defaultValue="365"
              id="new-project-retention-days"
              min="1"
              name="content_retention_days"
              type="number"
            />
          </div>

          <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
            Create project
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
