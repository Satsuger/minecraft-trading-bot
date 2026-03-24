export function formatMinecraftText(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return normalizeWhitespace(value.map((entry) => formatMinecraftText(entry)).join(""));
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const parts: string[] = [];

  if ("text" in record) {
    parts.push(formatMinecraftText(record.text));
  }

  if ("translate" in record) {
    const translationKey = formatMinecraftText(record.translate);
    const translationArgs = Array.isArray(record.with)
      ? record.with
          .map((entry) => formatMinecraftText(entry))
          .filter((entry) => entry.length > 0)
      : [];

    if (translationKey) {
      parts.push([translationKey, ...translationArgs].join(" "));
    }
  }

  if (Array.isArray(record.extra)) {
    parts.push(...record.extra.map((entry) => formatMinecraftText(entry)));
  }

  const normalized = normalizeWhitespace(parts.join(""));
  if (normalized) {
    return normalized;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
