"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import type { GuestListItem, GuestListResponse } from "@/lib/types";
export function GuestConversionPicker() {
  const t = useTranslations("workspace");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<GuestListItem[]>([]);
  const [selected, setSelected] = useState<GuestListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      if (search.trim().length < 2) {
        setItems([]);
        setBusy(false);
        setError("");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/guests?search=${encodeURIComponent(search.trim())}&limit=15`,
          { credentials: "include", signal: abort.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(t("lookupFailed"));
        const data = (await response.json()) as GuestListResponse;
        if (!abort.signal.aborted)
          setItems(data.items.filter((g) => g.visitStatus !== "member"));
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : t("lookupFailed"));
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [search, t]);
  return (
    <div className="space-y-3">
      <input type="hidden" name="guestId" value={selected?._id || ""} />
      {selected && (
        <div className="flex items-center justify-between rounded-xl bg-white p-3 text-sm">
          <span>
            {selected.firstName} {selected.lastName}
          </span>
          <button
            type="button"
            className="text-orange-700"
            onClick={() => setSelected(null)}
          >
            {t("remove")}
          </button>
        </div>
      )}
      <input
        aria-label={t("searchGuests")}
        className="ui-input"
        placeholder={t("searchGuests")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
      />
      <p className="text-xs text-[#8a8780]">{t("typeToSearch")}</p>
      {busy && (
        <p role="status" className="text-xs">
          {t("searching")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {items.map((g) => (
          <li key={g._id}>
            <button
              type="button"
              className="w-full rounded-xl border border-black/5 bg-white p-3 text-left text-sm hover:border-orange-300"
              onClick={() => {
                setSelected(g);
                setSearch("");
                setItems([]);
              }}
            >
              {g.firstName} {g.lastName}
              <span className="block text-xs text-[#8a8780]">
                {g.email || g.phone}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
