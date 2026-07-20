import sitemap from "@astrojs/sitemap"
import starlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"
import { normalizeBase } from "./scripts/contracts"

const site = process.env["SITE"]?.trim() || "https://example.com"
const base = normalizeBase(process.env["BASE"])

export default defineConfig({
  site,
  base,
  vite: { preview: { strictPort: true } },
  integrations: [
    sitemap(),
    starlight({
      title: "AI Auth Kit",
      description: "Provider authentication and model selection for host tools.",
      customCss: ["./src/styles/global.css"],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Start here", link: "/start/" },
            { label: "Quickstart", link: "/start/quickstart/" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Library", link: "/guides/library/" },
            { label: "Providers and auth", link: "/guides/providers-auth/" },
            { label: "Storage and privacy", link: "/guides/storage-privacy/" },
            { label: "Models.dev", link: "/guides/models-dev/" },
            { label: "CLIProxyAPI", link: "/guides/cliproxy/" },
            { label: "Agent skill", link: "/guides/agent-skill/" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Library API", link: "/reference/api/" },
            { label: "Security", link: "/reference/security/" },
          ],
        },
      ],
      social: [
        {
          icon: "github",
          label: "AI Auth Kit on GitHub",
          href: "https://github.com/abran-labs/ai-auth-kit",
        },
      ],
    }),
  ],
})
