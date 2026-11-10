/** Lowercase, no accents, trimmed: for searching and comparing names ("Júlia" ~ "julia"). */
export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
