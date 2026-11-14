/** Escapes regex metacharacters so user input can never alter the pattern (ReDoS/injection safe). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive partial-match regex built from raw user input. */
export function buildSearchRegex(value: string): RegExp {
  return new RegExp(escapeRegExp(value.trim()), 'i');
}
