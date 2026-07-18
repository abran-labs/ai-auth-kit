import type { Page } from "playwright"

type RouteName = "landing" | "quickstart" | "start"

type CaptureStateOptions = {
  readonly page: Page
  readonly route: RouteName
  readonly scheme: "dark" | "light"
  readonly width: number
}

const initialTocLabels = {
  start: "Overview",
  quickstart: "Overview",
} as const

async function waitForAnimationFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

export async function settleCaptureState(options: CaptureStateOptions): Promise<readonly string[]> {
  await options.page.evaluate(async () => {
    await document.fonts.ready
  })
  await options.page.evaluate(() => window.scrollTo({ behavior: "instant", left: 0, top: 0 }))
  await options.page.waitForFunction(() => window.scrollX === 0 && window.scrollY === 0)
  await options.page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  )
  await options.page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.playState === "finished") animation.cancel()
    }
  })
  await waitForAnimationFrames(options.page)

  if (options.route === "landing") return []
  const expected = initialTocLabels[options.route]
  await options.page.waitForFunction((label) => {
    const summary = document.querySelector("mobile-starlight-toc .display-current")
    const visibleTocs = Array.from(
      document.querySelectorAll("starlight-toc nav, mobile-starlight-toc nav"),
    ).filter((toc) => {
      const bounds = toc.getBoundingClientRect()
      const style = getComputedStyle(toc)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden"
    })
    const currentLinks = visibleTocs.flatMap((toc) =>
      Array.from(toc.querySelectorAll('a[aria-current="true"]')),
    )
    return (
      summary?.textContent?.trim() === label &&
      visibleTocs.length === 1 &&
      currentLinks.length === 1 &&
      currentLinks[0]?.textContent?.trim() === label
    )
  }, expected)
  await waitForAnimationFrames(options.page)

  const state = await options.page.evaluate(() => {
    const currentLinks = Array.from(
      document.querySelectorAll("starlight-toc nav, mobile-starlight-toc nav"),
    )
      .filter((toc) => {
        const bounds = toc.getBoundingClientRect()
        const style = getComputedStyle(toc)
        return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden"
      })
      .flatMap((toc) => Array.from(toc.querySelectorAll('a[aria-current="true"]')))
    const probe = document.createElement("span")
    probe.style.color = "var(--accent-strong)"
    document.body.append(probe)
    const accentColor = getComputedStyle(probe).color
    probe.remove()
    return {
      accentColor,
      current: currentLinks.map((link) => link.textContent?.trim() ?? ""),
      currentColor: currentLinks[0] === undefined ? "" : getComputedStyle(currentLinks[0]).color,
      summary:
        document.querySelector("mobile-starlight-toc .display-current")?.textContent?.trim() ?? "",
      x: window.scrollX,
      y: window.scrollY,
    }
  })
  const label = `${options.route} ${options.scheme} at ${options.width}px`
  const findings: string[] = []
  if (state.x !== 0 || state.y !== 0)
    findings.push(`${label} capture scroll is ${state.x},${state.y}`)
  if (state.summary !== expected) {
    findings.push(`${label} mobile TOC summary is ${state.summary || "empty"}`)
  }
  if (state.current.length !== 1 || state.current[0] !== expected) {
    findings.push(`${label} current TOC links are ${state.current.join(", ") || "empty"}`)
  }
  if (options.width >= 1280 && state.currentColor !== state.accentColor) {
    findings.push(`${label} current TOC color ${state.currentColor} is not ${state.accentColor}`)
  }
  return findings
}
