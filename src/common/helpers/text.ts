export function removeMiddle(s: string, cornerLength: number = 4) {
    if (s.length < cornerLength * 2) {
        return s
    }
    const first = s.slice(0, cornerLength)
    const last = s.slice(-cornerLength)
    return `${first}...${last}`
}
