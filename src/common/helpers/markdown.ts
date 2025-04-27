export function escapeMarkdown(text: string): string {
    return text.replaceAll(/([!#()*+.=>[\]_`{|}~-])/g, String.raw`\$1`)
}
