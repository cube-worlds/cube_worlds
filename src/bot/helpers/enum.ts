export function getEnumKeyByValue<T extends { [index: string]: string | number }>(
  enumObject: T,
  value: string | number,
): keyof T | undefined {
  const keys = Object.keys(enumObject) as Array<keyof T>
  return keys.find(key => enumObject[key] === value)
}
