"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { FormEvent, useState } from "react"

import SocialAuthButtons from "@/components/auth/social-auth-buttons"

type LoginFormProps = {
  callbackUrl: string
}

/**
 * Render the primary sign-in form for project users.
 *
 * The component bridges the branded login UI to NextAuth credential sign-in. It
 * trims the username field before submission, shows inline errors returned by the
 * auth flow, and navigates to either the returned redirect URL or the provided
 * callback URL on success. While a request is in flight, the submit button switches
 * to a loading label and prevents duplicate submissions.
 *
 * @param props - Component props.
 * @param props.callbackUrl - Fallback destination used when sign-in succeeds without
 * an explicit redirect URL.
 * @returns The login form card with social sign-in options and password auth fields.
 * @example
 * ```tsx
 * <LoginForm callbackUrl="/content/4?project=2" />
 * ```
 */
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
    <div className="w-full max-w-md space-y-8 rounded-3xl border border-border/12 bg-card/90 p-8 shadow-panel backdrop-blur-xl">
      <div className="text-center">
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-muted">
          Newsletter Maker
        </p>
        <h2 className="mt-2 font-display text-display-page font-bold text-foreground">
          Welcome back
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Sign in with your project account or continue with an enabled social provider.
        </p>
      </div>

      <SocialAuthButtons />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/12" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted">Or continue with password</span>
        </div>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-2xl">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username or email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="mt-1 block w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              placeholder="your_username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              placeholder="••••••••"
            />
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-border/20 text-primary focus:ring-primary/20"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-foreground">
              Remember me
            </label>
          </div>

          <p className="text-sm text-muted">Password reset is handled by the API.</p>
        </div>

        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-muted">
          Need an account? Use the <Link href="/admin/" className="font-medium text-primary hover:text-primary">Django admin</Link> or registration API.
        </p>
      </form>
    </div>
  )
}
