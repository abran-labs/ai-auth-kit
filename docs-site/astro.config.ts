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
      description: "Provider authentication, model selection, and private project storage.",
      customCss: ["./src/styles/global.css"],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Start here", link: "/start/" },
            { label: "60-second quickstart", link: "/start/quickstart/" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Library", link: "/guides/library/" },
            { label: "CLI", link: "/guides/cli/" },
            { label: "Providers and auth", link: "/guides/providers-auth/" },
            { label: "Storage and privacy", link: "/guides/storage-privacy/" },
            { label: "Models.dev", link: "/guides/models-dev/" },
            { label: "CLIProxyAPI", link: "/guides/cliproxy/" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Library API", link: "/reference/api/" },
            { label: "CLI", link: "/reference/cli/" },
            { label: "Security", link: "/reference/security/" },
            { label: "Linux installer", link: "/reference/linux-installer/" },
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
