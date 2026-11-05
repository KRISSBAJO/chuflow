"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/ui";
import type { CarePerson } from "@/lib/care";
export function CarePicker({
  branchId,
  selected,
  onChange,
  single = false,
  leadersOnly = false,
}: {
  branchId: string;
  selected: CarePerson[];
  onChange: (people: CarePerson[]) => void;
  single?: boolean;
  leadersOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{
    query: string;
    items: CarePerson[];
  }>({ query: "", items: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/care/assignees?branchId=${encodeURIComponent(branchId)}&q=${encodeURIComponent(q.trim())}&leadersOnly=${leadersOnly}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Could not find care workers.");
        const items = (await response.json()) as CarePerson[];
        if (!controller.signal.aborted) {
          setMatches({ query: q.trim(), items });
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Search failed.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, q, leadersOnly]);
  return (
    <div className="space-y-2">
      <input
        className="ui-input"
        value={q}
        aria-label="Find a care worker"
        placeholder="Type a care worker’s name or email…"
        onChange={(e) => setQ(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {q.trim().length >= 2 && matches.query === q.trim() && (
        <div className="rounded-xl bg-white p-2">
          {matches.items.length === 0 && (
            <p className="p-2 text-sm text-[#8a8780]">
              No matching active care workers.
            </p>
          )}
          {matches.items.map((p) => (
            <Button
              className="w-full justify-start"
              key={p._id}
              variant="ghost"
              onClick={() => {
                onChange(
                  single
                    ? [p]
                    : selected.some((x) => x._id === p._id)
                      ? selected
                      : [...selected, p],
                );
                setQ("");
              }}
            >
              {p.firstName} {p.lastName}
            </Button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {selected.map((p) => (
          <Button
            key={p._id}
            size="sm"
            variant="secondary"
            onClick={() => onChange(selected.filter((x) => x._id !== p._id))}
          >
            {p.firstName} {p.lastName} ×
          </Button>
        ))}
      </div>
    </div>
  );
}
