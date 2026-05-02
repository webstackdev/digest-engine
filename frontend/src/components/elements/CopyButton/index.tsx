"use client"

import { CopyIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

type CopyButtonProps = {
  /** The string value to copy. */
  value: string
  /** Default button label before a successful copy action. */
  label: string
  /** Optional label shown after a successful copy action. */
  copiedLabel?: string
}

/**
 * Copy a string value to the clipboard and briefly acknowledge success.
 *
 */
export function CopyButton({ value, label, copiedLabel = "Copied" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    if (!navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => {
      setCopied(false)
    }, 1600)
  }

  return (
    <Button
      onClick={handleClick}
      type="button"
      variant="outline"
    >
      {!copied ? <CopyIcon aria-hidden="true" /> : null}
      {copied ? copiedLabel : label}
    </Button>
  )
}
