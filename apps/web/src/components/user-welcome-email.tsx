"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { UserSummary } from "@/lib/types";

export function UserWelcomeEmail({ user }: { user: UserSummary }) {
  const t = useTranslations("org.userList");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function sendWelcome() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/${user._id}/welcome`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(t("welcomeFailed"));
      if (result.status === "accepted") toast.success(t("welcomeAccepted"));
      else if (result.status === "recently_requested")
        toast.info(t("welcomeRecent"));
      else if (result.status === "inactive") toast.info(t("welcomeInactive"));
      else toast.error(t("welcomeFailed"));
      router.refresh();
    } catch {
      toast.error(t("welcomeFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t border-black/[0.06] pt-5">
      <h3 className="font-medium">{t("welcomeTitle")}</h3>
      <p className="my-2 max-w-xl text-sm text-[#6b6b6b]">{t("welcomeHint")}</p>
      {user.welcomeEmailStatus && (
        <p className="mb-3 text-xs text-[#6b6b6b]">
          {t("welcomeLast", { status: user.welcomeEmailStatus })}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        disabled={loading || !user.isActive}
        onClick={() => sendWelcome()}
      >
        {loading ? t("sendingWelcome") : t("sendWelcome")}
      </Button>
    </div>
  );
}
