import nextra from "nextra";

// Set up Nextra with its configuration
const withNextra = nextra({
  contentDirBasePath: "/",
});

// Export the final Next.js config with Nextra included
export default withNextra({
  output: "export",
  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.js",
    },
  },
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
