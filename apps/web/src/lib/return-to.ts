export function safeReturnTo(value?: string | null, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const target = new URL(value, "https://chuflow.invalid");
    if (target.origin !== "https://chuflow.invalid" || /^\/(login|forgot-password|reset-password)(\/|$)/.test(target.pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return fallback; }
}
