"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/ui";

type Match = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export function OutreachGuestLink({ contactId }: { contactId: string }) {
  const actionToast = useActionToast();

  const router = useRouter();
  const t = useTranslations("people.evangelism.guestLink");
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
      setError(e instanceof Error ? e.message : t("errorCheck"));
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

      actionToast.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorLink"));
      setError(e instanceof Error ? e.message : t("errorLink"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <p className="text-sm text-[#6b6b6b]">{t("description")}</p>
      {matches === null ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={find}>
          {busy ? t("checking") : t("find")}
        </Button>
      ) : matches.length ? (
        <>
          <label className="block text-sm">
            {t("matchingGuest")}
            <select
              className="ui-input mt-1"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">{t("chooseSame")}</option>
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
            {busy ? t("linking") : t("confirmLink")}
          </Button>
        </>
      ) : (
        <p className="text-sm">
          {t.rich("noMatch", {
            link: (chunks) => (
              <Link href="/guests/new" className="underline">
                {chunks}
              </Link>
            ),
          })}
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
