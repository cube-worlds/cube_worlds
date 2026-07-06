export function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
  partials: Record<string, string> = {},
): string {
  // Expand partials first (single nesting level is enough for this site).
  const withPartials = tpl.replace(
    /\{\{>\s*([\w-]+)\s*\}\}/g,
    (_m, name: string) => partials[name] ?? '',
  )
  return withPartials.replace(
    /\{\{\s*([\w-]+)\s*\}\}/g,
    (_m, key: string) => vars[key] ?? '',
  )
}
