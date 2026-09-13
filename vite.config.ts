// The bundled config provides the TanStack Start/Vite plugins. Vendora is
// deployed on Vercel, so Nitro must target Vercel's server runtime rather than
// its Cloudflare-module default; server functions then receive process.env at
// request time and unprefixed secrets remain server-only.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "vercel",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
