import type { Browser } from "playwright"

type ReducedMotionQaOptions = {
  readonly baseUrl: string
  readonly browser: Browser
  readonly width: number
}

export async function reducedMotionFindings(
  options: ReducedMotionQaOptions,
): Promise<readonly string[]> {
  const context = await options.browser.newContext({
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport: { width: options.width, height: 900 },
  })
  const page = await context.newPage()
  try {
    await page.goto(options.baseUrl, { waitUntil: "networkidle" })
    const findings: string[] = []
    const heroDuration = await page
      .locator(".hero-copy")
      .evaluate((element) => getComputedStyle(element).animationDuration)
    if (heroDuration !== "0.01ms" && heroDuration !== "1e-05s") {
      findings.push(
        `reduced motion resolved hero duration to ${heroDuration} at ${options.width}px`,
      )
    }
    const trigger = page.locator(".appearance-trigger")
    await trigger.click()
    const menuDurations = await page
      .locator(".appearance-trigger, .appearance-option")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).transitionDuration),
      )
    if (menuDurations.some((duration) => duration !== "0.01ms" && duration !== "1e-05s")) {
      findings.push(`reduced motion left Appearance transitions at ${menuDurations.join(", ")}`)
    }
    return findings
  } finally {
    await context.close()
  }
}
