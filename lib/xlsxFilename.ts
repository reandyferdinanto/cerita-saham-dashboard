export function inferTradeDateFromFilename(fileName: string) {
  const compactMatch = fileName.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const dashedMatch = fileName.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (dashedMatch) {
    return `${dashedMatch[1]}-${dashedMatch[2]}-${dashedMatch[3]}`;
  }

  return null;
}
