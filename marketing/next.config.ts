import nextra from "nextra";
import { withSentryConfig } from "@sentry/nextjs";

const telemetryEnabled = process.env.NODE_ENV !== "development";

// Set up Nextra with its configuration
const withNextra = nextra({
  contentDirBasePath: "/",
});

// Export the final Next.js config with Nextra included
const nextConfigWithNextra = withNextra({
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "torqbit-dev.b-cdn.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "iframe.mediadelivery.net" },
      { protocol: "https", hostname: "torqbit.b-cdn.net" },
      { protocol: "https", hostname: "cdn.torqbit.com" },
    ],
  },
});

export default telemetryEnabled
  ? withSentryConfig(nextConfigWithNextra, {
      org: "webstack-builders",
      project: "digestengine-marketing",
      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,
      // Pass the auth token
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Upload a larger set of source maps for prettier stack traces
      widenClientFileUpload: true,
    })
  : nextConfigWithNextra;
