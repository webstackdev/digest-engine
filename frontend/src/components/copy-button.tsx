"use client"

import { useState } from "react"

type CopyButtonProps = {
  value: string
  label: string
}

/**
 * Copy a string value to the clipboard and briefly acknowledge success.
 *
 * @param props - Component props.
 * @param props.value - The string value to copy.
 * @param props.label - Default button label before a successful copy action.
 * @returns A client button that copies the provided value when clicked.
 */
export function CopyButton({ value, label }: CopyButtonProps) {
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
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50"
      onClick={handleClick}
      type="button"
    >
      {copied ? "Copied" : label}
    </button>
  )
}
