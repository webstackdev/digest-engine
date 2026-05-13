"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"

type AvatarDropzoneProps = {
  /** Whether an avatar upload request is currently in flight. */
  isUploading: boolean
  /** Callback that uploads a selected avatar image. */
  onUpload: (file: File) => Promise<void>
}

const MAX_FILE_SIZE = 2 * 1024 * 1024

/** Render the drag-and-drop avatar upload surface. */
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
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Upload</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-content-active">
            Drag, drop, or browse
          </h2>
        </div>

        <div
          {...getRootProps()}
          className={`rounded-3xl border border-dashed px-5 py-8 text-center transition ${
            isDragReject
              ? "border-destructive bg-destructive"
              : isDragActive
                ? "border-primary bg-primary"
                : "border-trim-offset bg-muted hover:border-primary hover:bg-muted"
          } ${isUploading ? "cursor-wait opacity-70" : "cursor-pointer"}`}
        >
          <input {...getInputProps({ "aria-label": "Upload avatar image" })} />
          <p className="m-0 text-base font-medium text-content-active">
            {isUploading ? "Uploading avatar..." : "Drop an image here or click to browse."}
          </p>
          <p className="mb-0 mt-2 text-sm leading-6 text-muted">
            PNG, JPEG, and WebP files up to 2 MB.
          </p>
        </div>

        {errorMessage ? (
          <Alert className="rounded-3xl border-destructive bg-destructive" variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
