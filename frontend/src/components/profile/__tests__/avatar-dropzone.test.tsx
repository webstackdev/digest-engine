import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AvatarDropzone } from "@/components/profile/avatar-dropzone"

describe("AvatarDropzone", () => {
  it("passes an accepted file to the upload callback", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)

    render(<AvatarDropzone isUploading={false} onUpload={onUpload} />)

    const input = screen.getByLabelText("Upload avatar image")
    const file = new File(["avatar"], "avatar.png", { type: "image/png" })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file)
    })
  })
})
