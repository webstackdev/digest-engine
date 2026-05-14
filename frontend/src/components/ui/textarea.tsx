import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-trim-offset bg-transparent px-2.5 py-2 text-base transition-colors placeholder:text-content-offset disabled:cursor-not-allowed disabled:bg-page-offset disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
