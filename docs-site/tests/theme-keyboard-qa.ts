import type { BrowserContext, ElementHandle, Page } from "playwright"

type Theme = "dark" | "light"

type ThemeQaOptions = {
  readonly context: BrowserContext
  readonly url: string
  readonly width: number
}

async function waitForTheme(
  page: Page,
  control: ElementHandle<HTMLElement | SVGElement>,
  expected: Theme,
): Promise<void> {
  await page.waitForFunction(
    ({ element, theme }) =>
      element instanceof HTMLSelectElement &&
      element.isConnected &&
      element.value === theme &&
      document.documentElement.dataset["theme"] === theme &&
      localStorage.getItem("starlight-theme") === theme,
    { element: control, theme: expected },
  )
}

export async function keyboardThemeFindings(options: ThemeQaOptions): Promise<readonly string[]> {
  const findings: string[] = []
  const page = await options.context.newPage()
  try {
    await page.goto(options.url, { waitUntil: "networkidle" })
    await page.evaluate(() => localStorage.removeItem("starlight-theme"))
    await page.reload({ waitUntil: "networkidle" })

    if (options.width < 800) {
      const menuButton = page.locator("starlight-menu-button button:visible")
      await menuButton.focus()
      await menuButton.press("Enter")
      await page.waitForFunction(() => document.body.hasAttribute("data-mobile-menu-expanded"))
    }

    const selector =
      options.width < 800
        ? "#starlight__sidebar starlight-theme-select select:visible"
        : "header starlight-theme-select select:visible"
    const themeControl = page.locator(selector)
    await themeControl.waitFor({ state: "visible" })
    if ((await themeControl.count()) !== 1) {
      return [`expected one visible theme control at ${options.width}px`]
    }

    const initialValue = await themeControl.inputValue()
    const initialTheme = await page.locator("html").getAttribute("data-theme")
    if (initialValue !== "auto" || initialTheme !== "dark") {
      findings.push(
        `theme initial state resolved ${initialTheme ?? "unset"}/${initialValue} at ${options.width}px`,
      )
    }

    const themeElement = await themeControl.elementHandle()
    if (themeElement === null) return [`theme control detached at ${options.width}px`]

    await themeControl.focus()
    await themeControl.press("Home")
    await waitForTheme(page, themeElement, "dark")
    await themeControl.press("ArrowDown")
    await waitForTheme(page, themeElement, "light")
    await themeControl.press("ArrowUp")
    await waitForTheme(page, themeElement, "dark")
  } finally {
    await page.close()
  }
  return findings
}
