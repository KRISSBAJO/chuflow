"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/ui";

type Match = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export function OutreachGuestLink({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  async function find() {
    setBusy(true);
    setError("");
    try {
      setMatches(
        await apiGet<Match[]>(
          `/evangelism/contacts/${contactId}/guest-matches`,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not check for a guest record.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function link() {
    setBusy(true);
    setError("");
    try {
      await apiPost(`/evangelism/contacts/${contactId}/link-guest`, {
        guestId: selected,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link guest record.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">Continue their church journey</h3>
      <p className="text-sm text-[#6b6b6b]">
        If this person has attended church, link their existing guest record to
        keep their outreach history connected. Confirm their identity before
        linking.
      </p>
      {matches === null ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={find}>
          {busy ? "Checking…" : "Find matching guest record"}
        </Button>
      ) : matches.length ? (
        <>
          <label className="block text-sm">
            Matching guest
            <select
              className="ui-input mt-1"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose the same person</option>
              {matches.map((match) => (
                <option key={match._id} value={match._id}>
                  {match.firstName} {match.lastName} · {match.phone}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={!selected || busy}
            onClick={link}
          >
            {busy ? "Linking…" : "Confirm and link guest"}
          </Button>
        </>
      ) : (
        <p className="text-sm">
          No guest record matches this phone or email in the same branch. If
          they have visited,{" "}
          <Link href="/guests/new" className="underline">
            register their church visit
          </Link>
          , then return here to link it.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
