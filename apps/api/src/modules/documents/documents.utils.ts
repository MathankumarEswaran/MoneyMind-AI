export function chunkText(text: string, maxChars = 1000, overlap = 200): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + maxChars, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
    if (start === end) break;
  }
  return chunks;
}
