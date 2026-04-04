export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function wsUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";
  return `${base}${path}`;
}

export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  return `${base}${path}`;
}

export function currency(value: number, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD"
  }).format(value);
}
