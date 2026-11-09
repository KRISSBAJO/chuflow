export function campMajorUnit(currency: string) {
  return 10 ** (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2);
}

export function campMinorAmount(value: FormDataEntryValue | null, currency: string) {
  const amount = Number(value);
  const scale = campMajorUnit(currency);
  const minor = Math.round(amount * scale);
  return Number.isFinite(amount) && Math.abs(minor - amount * scale) < 0.00001 ? minor : null;
}
