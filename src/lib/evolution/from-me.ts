/** Evolution API may send fromMe as boolean, string, or number. */
export function isFromMe(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return false;
}
