import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OpsShell } from "@/components/ops/ops-shell";
import { requireOperator } from "@/lib/ops/session";

export const metadata: Metadata = { title: "Operator console · ChuFlow", robots: { index: false, follow: false } };

export default async function OpsConsoleLayout({ children }: { children: ReactNode }) {
  const operator = await requireOperator();
  return <OpsShell operator={operator}>{children}</OpsShell>;
}
