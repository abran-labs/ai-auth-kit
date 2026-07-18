import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "playwright"
import { normalizeBase } from "../scripts/contracts"
import { settleCaptureState } from "./capture-state-qa"
import {
  commandScrollFindings,
  interactiveFocusFindings,
  reducedMotionFindings,
  themeNavigationFindings,
} from "./interaction-qa"
import { keyboardThemeFindings } from "./theme-keyboard-qa"

class QaFailure extends Error {
  readonly findings: readonly string[]

  constructor(findings: readonly string[]) {
    super(`Browser QA failed:\n${findings.map((finding) => `- ${finding}`).join("\n")}`)
    this.name = "QaFailure"
    this.findings = findings
  }
}

const widths = [375, 768, 1280] as const
const schemes = ["light", "dark"] as const
const routes = [
  { name: "landing", path: "" },
  { name: "start", path: "start/" },
  { name: "quickstart", path: "start/quickstart/" },
] as const
const root = resolve(import.meta.dir, "..")
const basePath = normalizeBase(process.env["BASE"] ?? "/ai-auth-kit/")
const site = process.env["SITE"]?.trim() || "https://abran-labs.github.io"
const portValue = Number(process.env["QA_PORT"] ?? "4321")
if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65_535) {
  throw new QaFailure([`QA_PORT must be an integer from 1 to 65535; received ${portValue}`])
}

const origin = `http://127.0.0.1:${portValue}`
const evidenceDirectory = resolve(root, "test-results")
const runtimeEnvironment = { ...process.env, SITE: site, BASE: basePath }
const findings: string[] = []

await mkdir(evidenceDirectory, { recursive: true })
const build = Bun.spawn(["bun", "run", "build"], {
  cwd: root,
  env: runtimeEnvironment,
  stderr: "inherit",
  stdout: "inherit",
})
if ((await build.exited) !== 0) throw new QaFailure(["production build failed"])

const preview = Bun.spawn(
  ["bun", "run", "preview", "--host", "127.0.0.1", "--port", String(portValue)],
  { cwd: root, env: runtimeEnvironment, stderr: "inherit", stdout: "inherit" },
)

async function waitForPreview(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new QaFailure([`preview exited with code ${preview.exitCode} before becoming ready`])
    }
    try {
      const response = await fetch(`${origin}${basePath}`)
      if (response.ok && preview.exitCode === null) return
    } catch (error) {
      if (!(error instanceof Error)) throw error
    }
    await Bun.sleep(50)
  }
  throw new QaFailure([`preview did not become ready at ${origin}${basePath}`])
}

try {
  await waitForPreview()
  const chromiumPath = process.env["CHROMIUM_PATH"]
  const browser = await chromium.launch(
    chromiumPath === undefined
      ? { headless: true }
      : { executablePath: chromiumPath, headless: true },
  )
  try {
    for (const width of widths) {
      for (const scheme of schemes) {
        const context = await browser.newContext({
          colorScheme: scheme,
          reducedMotion: "no-preference",
          viewport: { width, height: 900 },
        })
        const page = await context.newPage()
        const consoleErrors: string[] = []
        const failedResources: string[] = []
        if (scheme === "dark") {
          await page.addInitScript(() => localStorage.setItem("starlight-theme", "dark"))
        }
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text())
        })
        page.on("response", (response) => {
          if (response.status() >= 400) {
            failedResources.push(`${response.status()} ${response.url()}`)
          }
        })

        for (const route of routes) {
          await page.goto(`${origin}${basePath}${route.path}`, { waitUntil: "networkidle" })
          const pageState = await page.evaluate(() => {
            const rootStyle = getComputedStyle(document.documentElement)
            return {
              colorScheme: rootStyle.colorScheme,
              ink: rootStyle.getPropertyValue("--ink").trim(),
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              paper: rootStyle.getPropertyValue("--paper").trim(),
              theme: document.documentElement.dataset["theme"] ?? "",
            }
          })
          if (pageState.overflow) {
            findings.push(`${route.name} ${scheme} at ${width}px has horizontal overflow`)
          }
          if (pageState.paper === "" || pageState.ink === "" || pageState.paper === pageState.ink) {
            findings.push(`${route.name} ${scheme} at ${width}px has incomplete theme surfaces`)
          }
          if (scheme === "dark") {
            const resolvedDark =
              route.name === "landing"
                ? pageState.colorScheme.includes("dark")
                : pageState.theme === "dark"
            if (!resolvedDark) {
              findings.push(`${route.name} dark at ${width}px did not resolve dark theme`)
            }
          }
          const escapedLinks = await page
            .locator("a[href]")
            .evaluateAll(
              (anchors, base) =>
                anchors
                  .map((anchor) => anchor.getAttribute("href"))
                  .filter((href) => href?.startsWith("/") && !href.startsWith(base)),
              basePath,
            )
          if (escapedLinks.length > 0) {
            findings.push(
              `${route.name} ${scheme} at ${width}px has links escaping base: ${escapedLinks.join(", ")}`,
            )
          }
          findings.push(
            ...(await commandScrollFindings({ page, route: route.name, scheme, width })),
          )
          findings.push(
            ...(await interactiveFocusFindings({ page, route: route.name, scheme, width })),
          )
          findings.push(...(await settleCaptureState({ page, route: route.name, scheme, width })))
          const suffix = scheme === "dark" ? `-dark-${width}` : `-${width}`
          await page.screenshot({
            fullPage: true,
            path: resolve(evidenceDirectory, `${route.name}${suffix}.png`),
          })
        }

        if (scheme === "light") {
          await page.goto(`${origin}${basePath}`, { waitUntil: "networkidle" })
          await page.keyboard.press("Tab")
          const hasVisibleFocus = await page.evaluate(() => {
            const element = document.activeElement
            return (
              element instanceof HTMLElement && getComputedStyle(element).outlineStyle !== "none"
            )
          })
          if (!hasVisibleFocus) findings.push(`landing at ${width}px lacks visible focus`)
        } else {
          findings.push(
            ...(await keyboardThemeFindings({
              context,
              url: `${origin}${basePath}start/`,
              width,
            })),
          )
        }
        if (consoleErrors.length > 0) {
          findings.push(`${scheme} ${width}px console errors: ${consoleErrors.join(" | ")}`)
        }
        if (failedResources.length > 0) {
          findings.push(`${scheme} ${width}px failed resources: ${failedResources.join(", ")}`)
        }
        await context.close()
      }
      const baseUrl = `${origin}${basePath}`
      findings.push(...(await themeNavigationFindings({ baseUrl, browser, width })))
      findings.push(...(await reducedMotionFindings({ baseUrl, browser, width })))
    }
  } finally {
    await browser.close()
  }
} finally {
  preview.kill()
  await preview.exited
}

if (findings.length > 0) throw new QaFailure(findings)
console.log(`Browser QA passed; screenshots: ${evidenceDirectory}`)
