"use client";
import type { FormLanguage } from "@/lib/form-language";

export function FormLanguagePicker({
  value,
  onChange,
}: {
  value: FormLanguage;
  onChange: (language: FormLanguage) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      Language / Idioma
      <select
        aria-label="Language / Idioma"
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[#111111]"
        value={value}
        onChange={(event) => onChange(event.target.value as FormLanguage)}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  );
}
