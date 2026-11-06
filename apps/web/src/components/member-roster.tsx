"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, Badge, statusTone, TableWrap } from "@/components/ui/ui";
import { memberGroupNames } from "@/lib/member-service-groups";
import {
  useMemberFormLabels,
  normalizeYesNoValue,
} from "@/lib/member-form-options";
import { detailHref } from "@/lib/workspace-navigation";
import type { MemberListItem } from "@/lib/types";
import type { DirectoryParams } from "@/lib/directory";

export function MemberRoster({
  members,
  params,
}: {
  members: MemberListItem[];
  params: DirectoryParams;
}) {
  const t = useTranslations("org.members");
  const tc = useTranslations("common");
  const tw = useTranslations("workspace");
  const labels = useMemberFormLabels();
  const [columns, setColumns] = useState<string[]>([]);
  return (
    <>
      <details className="mb-3 text-sm">
        <summary className="w-fit cursor-pointer text-[#6b6b6b]">
          {tw("columns")}
        </summary>
        <div className="mt-3 flex gap-5">
          {[
            ["holySpirit", t("holySpirit")],
            ["foundation", t("foundation")],
          ].map(([id, label]) => (
            <label key={id} className="flex gap-2">
              <input
                type="checkbox"
                checked={columns.includes(id)}
                onChange={(e) =>
                  setColumns((c) =>
                    e.target.checked ? [...c, id] : c.filter((v) => v !== id),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </details>
      <TableWrap>
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t("member")}</th>
              <th>{tw("church")}</th>
              <th>{tc("status")}</th>
              <th>{t("serviceGroups")}</th>
              {columns.includes("holySpirit") && <th>{t("holySpirit")}</th>}
              {columns.includes("foundation") && <th>{t("foundation")}</th>}
              <th>
                <span className="sr-only">{tw("open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const name = [
                labels.title(member.title),
                member.firstName,
                member.lastName,
              ]
                .filter(Boolean)
                .join(" ");
              const href = detailHref("/members", member._id, params);
              return (
                <tr
                  key={member._id}
                  id={`record-${member._id}`}
                  className="scroll-mt-24"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={name} />
                      <Link
                        href={href}
                        className="font-medium hover:text-orange-700"
                      >
                        {name}
                      </Link>
                    </div>
                  </td>
                  <td>{member.branchId?.name || "—"}</td>
                  <td>
                    <Badge tone={statusTone(member.membershipStatus)} dot>
                      {labels.membershipStatus(member.membershipStatus)}
                    </Badge>
                  </td>
                  <td>{memberGroupNames(member) || t("notSet")}</td>
                  {columns.includes("holySpirit") && (
                    <td>
                      <Badge
                        tone={
                          normalizeYesNoValue(
                            member.holySpiritBaptismStatus,
                          ) === "yes"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {labels.yesNo(member.holySpiritBaptismStatus)}
                      </Badge>
                    </td>
                  )}
                  {columns.includes("foundation") && (
                    <td>
                      {labels.yesNo(member.believerFoundationClassStatus)}
                    </td>
                  )}
                  <td>
                    <Link
                      href={href}
                      aria-label={`${tw("open")} ${name}`}
                      className="whitespace-nowrap text-orange-700"
                    >
                      {tw("open")} ↗
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
