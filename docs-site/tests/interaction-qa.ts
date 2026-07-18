import type { Browser, Page } from "playwright"

type RouteName = "landing" | "quickstart" | "start"

type FocusQaOptions = {
  readonly page: Page
  readonly route: RouteName
  readonly scheme: "dark" | "light"
  readonly width: number
}

type ContextQaOptions = {
  readonly baseUrl: string
  readonly browser: Browser
  readonly width: number
}

async function focusFinding(
  page: Page,
  selector: string,
  label: string,
): Promise<string | undefined> {
  const locator = page.locator(selector).filter({ visible: true }).first()
  if ((await locator.count()) === 0) return `${label} is not visible`
  await locator.focus()
  const state = await locator.evaluate((element) => ({
    focused: element === document.activeElement && element.matches(":focus-visible"),
    outline: getComputedStyle(element).outlineStyle,
  }))
  if (!state.focused || state.outline === "none") return `${label} lacks visible keyboard focus`
  return undefined
}

async function collectFocusFinding(
  findings: string[],
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  const finding = await focusFinding(page, selector, label)
  if (finding !== undefined) findings.push(finding)
}

export async function interactiveFocusFindings(
  options: FocusQaOptions,
): Promise<readonly string[]> {
  const findings: string[] = []
  const prefix = `${options.route} ${options.scheme} at ${options.width}px`

  if (options.route === "landing") {
    for (const [selector, label] of [
      [".skip-link", "skip link"],
      [".wordmark", "wordmark"],
      [".mast-link", "mast link"],
      [".theme-select", "theme selector"],
      [".action", "hero action"],
      [".install-ledger", "install ledger"],
      [".pathway a", "pathway link"],
    ] as const) {
      await collectFocusFinding(findings, options.page, selector, `${prefix} ${label}`)
    }
    const wordmark = options.page.locator(".wordmark")
    await wordmark.focus()
    const lineCount = await wordmark.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getClientRects().length
    })
    if (lineCount !== 1) findings.push(`${prefix} focused wordmark spans ${lineCount} lines`)
    return findings
  }

  await collectFocusFinding(findings, options.page, "site-search button", `${prefix} search`)
  await collectFocusFinding(findings, options.page, ".pagination-links a", `${prefix} pagination`)
  if (options.width < 800) {
    const menuButton = options.page.locator("starlight-menu-button button:visible")
    await collectFocusFinding(
      findings,
      options.page,
      "starlight-menu-button button:visible",
      `${prefix} menu button`,
    )
    await menuButton.press("Enter")
    await options.page.waitForFunction(() =>
      document.body.hasAttribute("data-mobile-menu-expanded"),
    )
    await collectFocusFinding(
      findings,
      options.page,
      "#starlight__sidebar starlight-theme-select select:visible",
      `${prefix} mobile theme selector`,
    )
    await collectFocusFinding(
      findings,
      options.page,
      "#starlight__sidebar a:visible",
      `${prefix} sidebar link`,
    )
    await options.page.keyboard.press("Escape")
    await options.page.waitForFunction(
      () => !document.body.hasAttribute("data-mobile-menu-expanded"),
    )
  } else {
    await collectFocusFinding(
      findings,
      options.page,
      "header starlight-theme-select select:visible",
      `${prefix} theme selector`,
    )
    await collectFocusFinding(
      findings,
      options.page,
      "#starlight__sidebar a:visible",
      `${prefix} sidebar link`,
    )
  }
  await options.page.locator("site-search button").filter({ visible: true }).first().focus()
  return findings
}

export async function commandScrollFindings(options: FocusQaOptions): Promise<readonly string[]> {
  if (options.route === "start") return []
  const selector = options.route === "landing" ? ".install-ledger" : ".expressive-code pre"
  const label = `${options.route} ${options.scheme} at ${options.width}px command block`
  const block = options.page.locator(selector).first()
  if ((await block.count()) === 0) return [`${label} is missing`]
  const state = await block.evaluate((element) => {
    const start = element.scrollLeft
    element.scrollLeft = element.scrollWidth
    const moved = element.scrollLeft > start
    element.scrollLeft = 0
    return {
      canOverflow: element.scrollWidth > element.clientWidth,
      moved,
      overflowX: getComputedStyle(element).overflowX,
    }
  })
  const findings: string[] = []
  if (!state.canOverflow) findings.push(`${label} does not contain the full scrollable command`)
  if (state.overflowX !== "auto" && state.overflowX !== "scroll") {
    findings.push(`${label} resolves overflow-x to ${state.overflowX}`)
  }
  if (!state.moved) findings.push(`${label} cannot be scrolled horizontally`)
  return findings
}

export async function themeNavigationFindings(
  options: ContextQaOptions,
): Promise<readonly string[]> {
  const findings: string[] = []
  const context = await options.browser.newContext({
    colorScheme: "light",
    reducedMotion: "no-preference",
    viewport: { width: options.width, height: 900 },
  })
  const page = await context.newPage()
  try {
    await page.goto(`${options.baseUrl}start/`, { waitUntil: "networkidle" })
    await page.evaluate(() => localStorage.setItem("starlight-theme", "dark"))
    await page.reload({ waitUntil: "networkidle" })
    await page.locator(".site-title").click()
    await page.waitForLoadState("networkidle")
    const landingTheme = await page.locator("html").getAttribute("data-theme")
    const landingControl = await page.locator("#landing-theme").inputValue()
    if (landingTheme !== "dark" || landingControl !== "dark") {
      findings.push(`docs-to-landing dark theme failed at ${options.width}px`)
    }
    await page.locator("#landing-theme").selectOption("light")
    await page.locator('.mast-link[href$="start/"]').click()
    await page.waitForLoadState("networkidle")
    if ((await page.locator("html").getAttribute("data-theme")) !== "light") {
      findings.push(`landing-to-docs light theme failed at ${options.width}px`)
    }
    await page.locator(".site-title").click()
    await page.waitForLoadState("networkidle")
    await page.emulateMedia({ colorScheme: "dark" })
    await page.locator("#landing-theme").selectOption("auto")
    await page.waitForFunction(() => document.documentElement.dataset["theme"] === "dark")
    await page.emulateMedia({ colorScheme: "light" })
    await page.waitForFunction(() => document.documentElement.dataset["theme"] === "light")
  } finally {
    await context.close()
  }
  return findings
}

export async function reducedMotionFindings(options: ContextQaOptions): Promise<readonly string[]> {
  const context = await options.browser.newContext({
    colorScheme: "light",
    reducedMotion: "reduce",
    viewport: { width: options.width, height: 900 },
  })
  const page = await context.newPage()
  try {
    await page.goto(options.baseUrl, { waitUntil: "networkidle" })
    const duration = await page
      .locator(".hero-copy")
      .evaluate((element) => getComputedStyle(element).animationDuration)
    return duration === "0.01ms" || duration === "1e-05s"
      ? []
      : [`reduced motion resolved hero duration to ${duration} at ${options.width}px`]
  } finally {
    await context.close()
  }
}
