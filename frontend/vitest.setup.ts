import "@testing-library/jest-dom"

import { cleanup } from "@testing-library/react"
import { type ComponentPropsWithoutRef, createElement } from "react"
import { afterEach, vi } from "vitest"

// 1. Mock the Next.js Router
// This prevents tests from crashing when components use 'useRouter' or 'usePathname'
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// 2. Mock Next/Image
// Replaces the optimized Image component with a standard <img> tag for faster testing
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: ComponentPropsWithoutRef<"img">) => {
    return createElement("img", { ...props, alt: props.alt })
  },
}))

// 3. Cleanup after each test
// This ensures a clean DOM state between tests
afterEach(() => {
  cleanup()
})
