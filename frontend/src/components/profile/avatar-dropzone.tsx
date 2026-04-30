"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"

type AvatarDropzoneProps = {
  isUploading: boolean
  onUpload: (file: File) => Promise<void>
}

const MAX_FILE_SIZE = 2 * 1024 * 1024

/**
 * Render the drag-and-drop avatar upload surface.
 *
 * @param props - Dropzone props.
 * @returns The avatar upload card.
 */
export function AvatarDropzone({
  isUploading,
  onUpload,
}: AvatarDropzoneProps) {
  const [errorMessage, setErrorMessage] = useState("")

  const { getInputProps, getRootProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
    },
    disabled: isUploading,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    onDropAccepted: (files) => {
      const selectedFile = files[0]
      if (!selectedFile) {
        return
      }

      setErrorMessage("")
      void onUpload(selectedFile)
    },
    onDropRejected: (rejections) => {
      const firstError = rejections[0]?.errors[0]?.message
      setErrorMessage(
        firstError ?? "Upload a PNG, JPEG, or WebP image under 2 MB.",
      )
    },
  })

  return (
    <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="space-y-1">
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Upload</p>
        <h2 className="m-0 font-display text-title-sm font-bold text-ink">
          Drag, drop, or browse
        </h2>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-3xl border border-dashed px-5 py-8 text-center transition ${
          isDragReject
            ? "border-danger/40 bg-danger/10"
            : isDragActive
              ? "border-primary/45 bg-primary/8"
              : "border-ink/16 bg-surface-strong/45 hover:border-primary/28 hover:bg-surface-strong/60"
        } ${isUploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}
      >
        <input {...getInputProps({ "aria-label": "Upload avatar image" })} />
        <p className="m-0 text-base font-medium text-ink">
          {isUploading ? "Uploading avatar..." : "Drop an image here or click to browse."}
        </p>
        <p className="mt-2 mb-0 text-sm leading-6 text-muted">
          PNG, JPEG, and WebP files up to 2 MB.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-panel bg-danger/12 px-4 py-3 text-sm leading-6 text-danger-ink">
          {errorMessage}
        </div>
      ) : null}
    </article>
  )
}
