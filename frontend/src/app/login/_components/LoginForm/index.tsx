"use client"

import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { FormEvent, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginFormProps = {
  /** Fallback destination used when sign-in succeeds without a redirect URL. */
  callbackUrl: string
}

/** Render the project credential sign-in form. */
export default function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get("username") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    const response = await signIn("credentials", {
      username,
      password,
      callbackUrl,
      redirect: false,
    })

    setIsSubmitting(false)

    if (!response) {
      setErrorMessage("Unable to sign in right now.")
      return
    }

    if (response.error) {
      setErrorMessage(response.error)
      return
    }

    router.push(response.url ?? callbackUrl)
    router.refresh()
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Username or email</Label>
          <Input
            autoComplete="username"
            className="min-h-11 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active"
            id="username"
            name="username"
            placeholder="your_username"
            required
            type="text"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            autoComplete="current-password"
            className="min-h-11 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active"
            id="password"
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
      </div>

      {errorMessage ? (
        <Alert className="rounded-3xl border-danger bg-danger" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="remember-me" name="remember-me" />
          <Label className="text-sm text-content-active" htmlFor="remember-me">
            Remember me
          </Label>
        </div>

        <p className="text-sm text-content-offset">Password reset is handled by the API.</p>
      </div>

      <Button
        className="min-h-11 w-full rounded-full px-4 py-3"
        disabled={isSubmitting}
        size="lg"
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  )
}
