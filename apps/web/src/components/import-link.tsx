"use client";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useSession } from "@/components/session-context";
import { canAccessRoute } from "@/lib/permissions";
import { buttonClass } from "@/components/ui/ui";
import type { ImportKind } from "@/lib/import-fields";
export function ImportLink({ kind }: { kind: ImportKind }) {
  const { user } = useSession();
  const locale = useLocale();
  if (!canAccessRoute(user?.role, "/imports")) return null;
  return (
    <Link href={`/imports?kind=${kind}`} className={buttonClass("secondary")}>
      ↑{" "}
      {
        {
          en: "Import spreadsheet",
          es: "Importar hoja de cálculo",
          fr: "Importer un tableau",
          pt: "Importar planilha",
        }[locale]
      }
    </Link>
  );
}
