export function humanizeLine(line: string): string {
  return line
    .replace(/\./g, ". ")
    .replace(/—/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}
