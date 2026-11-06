"use client";
import { useTranslations } from "next-intl";

/**
 * Shared wording for the check-in flow (family selection + pickup receipt).
 * Strings live in `messages/<locale>/childrenDesk.json` under `childrenDesk.flow`;
 * this hook keeps the old `ChildrenFlowText` shape so callers can still pass it around.
 */
export type ChildrenFlowText = {
  family: string;
  heading: string;
  adult: string;
  room: string;
  spaces: (count: number) => string;
  already: string;
  linked: string;
  noRoom: string;
  confirm: string;
  staffConfirm: string;
  checking: string;
  submit: string;
  failed: string;
  receipt: string;
  keep: string;
  present: string;
  authorized: string;
  care: string;
  print: string;
  done: string;
  qrAlt: string;
  qrPreparing: string;
};

export function useFlowText(): ChildrenFlowText {
  const t = useTranslations("childrenDesk.flow");
  return {
    family: t("family"),
    heading: t("heading"),
    adult: t("adult"),
    room: t("room"),
    spaces: (count) => t("spaces", { count }),
    already: t("already"),
    linked: t("linked"),
    noRoom: t("noRoom"),
    confirm: t("confirm"),
    staffConfirm: t("staffConfirm"),
    checking: t("checking"),
    submit: t("submit"),
    failed: t("failed"),
    receipt: t("receipt"),
    keep: t("keep"),
    present: t("present"),
    authorized: t("authorized"),
    care: t("care"),
    print: t("print"),
    done: t("done"),
    qrAlt: t("qrAlt"),
    qrPreparing: t("qrPreparing"),
  };
}
