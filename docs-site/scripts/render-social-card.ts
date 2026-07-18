import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"

const root = resolve(import.meta.dir, "..")
const source = pathToFileURL(resolve(root, "public/social-card.svg")).href
const output = resolve(root, "public/social-card.png")
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.goto(source, { waitUntil: "load" })
  await page.screenshot({ path: output })
} finally {
  await browser.close()
}
