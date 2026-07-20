import type { Browser, Page } from "playwright"

type AppearanceQaOptions = {
  readonly baseUrl: string
  readonly browser: Browser
  readonly width: number
}

async function readAppearanceState(page: Page) {
  return page.evaluate(() => {
    const trigger = document.querySelector(".appearance-trigger")
    const selected = document.querySelector('[role="menuitemradio"][aria-checked="true"]')
    return {
      activeTag: document.activeElement?.tagName ?? "",
      expanded: trigger?.getAttribute("aria-expanded") ?? "missing",
      label: trigger?.getAttribute("aria-label") ?? "missing",
      selected: selected?.textContent?.trim() ?? "missing",
      stored: localStorage.getItem("starlight-theme"),
      theme: document.documentElement.dataset["theme"] ?? "missing",
    }
  })
}

function addMismatch(
  findings: string[],
  label: string,
  actual: string | null,
  expected: string,
): void {
  if (actual !== expected)
    findings.push(`${label}: expected ${expected}; received ${actual ?? "null"}`)
}

export async function appearanceMenuFindings(
  options: AppearanceQaOptions,
): Promise<readonly string[]> {
  const findings: string[] = []
  const context = await options.browser.newContext({
    colorScheme: "dark",
    reducedMotion: "no-preference",
    viewport: { width: options.width, height: 900 },
  })
  const page = await context.newPage()
  const prefix = `landing Appearance at ${options.width}px`
  try {
    await page.goto(options.baseUrl, { waitUntil: "networkidle" })
    await page.evaluate(() => localStorage.removeItem("starlight-theme"))
    await page.reload({ waitUntil: "networkidle" })
    const trigger = page.locator(".appearance-trigger")
    const menu = page.locator("#appearance-options")
    if ((await trigger.count()) !== 1) return [`${prefix}: expected one trigger`]

    let state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} default label`, state.label, "Appearance: System")
    addMismatch(findings, `${prefix} default storage`, state.stored, "")
    addMismatch(findings, `${prefix} dark system resolution`, state.theme, "dark")

    await trigger.click()
    addMismatch(
      findings,
      `${prefix} pointer open`,
      await trigger.getAttribute("aria-expanded"),
      "true",
    )
    if (!(await menu.isVisible())) findings.push(`${prefix}: pointer-opened menu is not visible`)
    await page.getByRole("heading", { level: 1 }).click()
    addMismatch(
      findings,
      `${prefix} outside dismissal`,
      await trigger.getAttribute("aria-expanded"),
      "false",
    )

    await trigger.focus()
    await trigger.press("Enter")
    const system = page.getByRole("menuitemradio", { name: "System" })
    if (!(await system.evaluate((element) => element === document.activeElement))) {
      findings.push(`${prefix}: Enter did not focus selected System option`)
    }
    await system.press("ArrowDown")
    const light = page.getByRole("menuitemradio", { name: "Light" })
    if (!(await light.evaluate((element) => element === document.activeElement))) {
      findings.push(`${prefix}: ArrowDown did not focus Light`)
    }
    await light.press("Enter")
    state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} Light storage`, state.stored, "light")
    addMismatch(findings, `${prefix} Light theme`, state.theme, "light")
    addMismatch(findings, `${prefix} Light label`, state.label, "Appearance: Light")

    await trigger.press(" ")
    await page.getByRole("menuitemradio", { name: "Light" }).press("End")
    const dark = page.getByRole("menuitemradio", { name: "Dark" })
    await dark.press(" ")
    state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} Dark storage`, state.stored, "dark")
    addMismatch(findings, `${prefix} Dark theme`, state.theme, "dark")

    await trigger.press("ArrowUp")
    await dark.press("Escape")
    state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} Escape close`, state.expanded, "false")
    if (!(await trigger.evaluate((element) => element === document.activeElement))) {
      findings.push(`${prefix}: Escape did not restore trigger focus`)
    }

    await trigger.press("Enter")
    await dark.press("Tab")
    addMismatch(
      findings,
      `${prefix} Tab close`,
      await trigger.getAttribute("aria-expanded"),
      "false",
    )
    if (await trigger.evaluate((element) => element === document.activeElement)) {
      findings.push(`${prefix}: Tab did not leave the trigger`)
    }

    await trigger.focus()
    await trigger.press("Enter")
    await dark.press("Home")
    await system.press("Enter")
    state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} System storage`, state.stored, "")
    addMismatch(findings, `${prefix} System dark resolution`, state.theme, "dark")
    await page.emulateMedia({ colorScheme: "light" })
    await page.waitForFunction(() => document.documentElement.dataset["theme"] === "light")

    await page.evaluate(() => localStorage.setItem("starlight-theme", "invalid"))
    await page.reload({ waitUntil: "networkidle" })
    state = await readAppearanceState(page)
    addMismatch(findings, `${prefix} invalid storage normalization`, state.stored, "")
    addMismatch(
      findings,
      `${prefix} invalid label normalization`,
      state.label,
      "Appearance: System",
    )
  } finally {
    await context.close()
  }

  if (options.width === 375) {
    const touchContext = await options.browser.newContext({
      colorScheme: "light",
      hasTouch: true,
      isMobile: true,
      viewport: { width: options.width, height: 900 },
    })
    const touchPage = await touchContext.newPage()
    try {
      await touchPage.goto(options.baseUrl, { waitUntil: "networkidle" })
      await touchPage.locator(".appearance-trigger").tap()
      await touchPage.getByRole("menuitemradio", { name: "Dark" }).tap()
      const state = await readAppearanceState(touchPage)
      addMismatch(findings, `${prefix} touch storage`, state.stored, "dark")
      addMismatch(findings, `${prefix} touch theme`, state.theme, "dark")
    } finally {
      await touchContext.close()
    }
  }

  return findings
}
