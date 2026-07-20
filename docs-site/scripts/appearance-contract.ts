const requiredKeyboardKeys = [
  "Tab",
  "Enter",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Escape",
] as const

export function appearanceContractViolations(source: string): readonly string[] {
  const visibleSource = source.replace(/<!--[\s\S]*?(?:-->|$)/g, "")
  const sectionStart = visibleSource.indexOf("### Appearance menu")
  if (sectionStart < 0) return ["DESIGN.md: missing Appearance menu contract"]
  const sectionEnd = visibleSource.indexOf("\n### ", sectionStart + 1)
  const section = visibleSource.slice(sectionStart, sectionEnd < 0 ? undefined : sectionEnd)
  const compactSection = section.replace(/\s+/g, " ")
  const violations: string[] = []
  if (
    /\bnative(?:\s+theme)?\s+select\b|select#landing-theme|HTMLSelectElement|<select/i.test(
      compactSection,
    )
  )
    violations.push("DESIGN.md: Appearance menu must not be a native select")
  if (
    /\bno keyboard support\b|\bwithout keyboard support\b|\bkeyboard (?:is )?(?:disabled|unsupported)\b/i.test(
      compactSection,
    )
  )
    violations.push("DESIGN.md: Appearance menu contradicts keyboard support")
  if (!/System.*internal `auto`/i.test(compactSection))
    violations.push("DESIGN.md: System must map to internal auto")
  const persistsEmptyPreference = /System.*empty string `""`.*`starlight-theme`/i.test(
    compactSection,
  )
  if (!persistsEmptyPreference)
    violations.push("DESIGN.md: System must persist an empty starlight-theme value")
  if (
    persistsEmptyPreference &&
    /\bSystem(?: option| preference)?\s+(?:also\s+)?persists?\s+(?:the\s+)?(?:literal\s+|internal\s+)?`auto`/i.test(
      compactSection,
    )
  ) {
    violations.push("DESIGN.md: System must not persist auto")
  }
  if (!/Light.*persists exactly `light`/i.test(compactSection))
    violations.push("DESIGN.md: Light must persist exactly light")
  if (!/Dark.*persists exactly `dark`/i.test(compactSection))
    violations.push("DESIGN.md: Dark must persist exactly dark")
  if (!/Missing or invalid values normalize to System/i.test(compactSection))
    violations.push("DESIGN.md: invalid preferences must normalize to System")
  for (const key of requiredKeyboardKeys)
    if (!section.includes(key)) violations.push(`DESIGN.md: Appearance menu missing ${key} key`)
  if (!/Escape restores focus to the button/i.test(compactSection))
    violations.push("DESIGN.md: Appearance menu must restore focus on Escape")
  for (const behavior of ["Pointer selection", "reduced motion", "mobile behavior"] as const)
    if (!section.toLowerCase().includes(behavior.toLowerCase()))
      violations.push(`DESIGN.md: Appearance menu missing ${behavior}`)
  if (!section.includes("data-theme"))
    violations.push("DESIGN.md: Appearance menu must resolve data-theme")
  return violations
}
