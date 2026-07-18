import type { APIRoute } from "astro"

export const GET: APIRoute = ({ site }) => {
  const publicSite = site ?? new URL("https://example.com")
  const sitemapUrl = new URL(`${import.meta.env.BASE_URL}sitemap-index.xml`, publicSite)
  const body = `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl.href}\n`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
