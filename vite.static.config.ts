import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Standalone static hosting. The Lovable preview uses vite.config.ts.
export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
    pages: ["/", "/details", "/play", "/trial", "/trial-result", "/summary", "/redeem"].map(
      (path) => ({ path }),
    ),
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
  },
});
