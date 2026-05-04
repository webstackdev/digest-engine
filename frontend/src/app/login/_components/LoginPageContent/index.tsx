import Link from "next/link"

import LoginForm from "@/app/login/_components/LoginForm"
import SocialAuthButtons from "@/app/login/_components/SocialAuthButtons"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type LoginPageContentProps = {
  /** Destination used after any successful sign-in flow. */
  callbackUrl: string
}

/** Render the full login-page shell and auth entry points. */
export default function LoginPageContent({ callbackUrl }: LoginPageContentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl border border-border/12 bg-card/90 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-8 pt-6">
          <div className="text-center">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-muted">
              Newsletter Maker
            </p>
            <h1 className="mt-2 font-display text-display-page font-bold text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in with your project account or continue with an enabled social provider.
            </p>
          </div>

          <SocialAuthButtons callbackUrl={callbackUrl} />

          <div className="relative">
            <Separator className="bg-border/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-card px-2 text-xs uppercase text-muted">
                Or continue with password
              </span>
            </div>
          </div>

          <LoginForm callbackUrl={callbackUrl} />

          <p className="text-center text-sm text-muted-foreground">
            Need an account? Use the <Link className="font-medium text-primary hover:text-primary" href="/admin/">Django admin</Link> or registration API.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
