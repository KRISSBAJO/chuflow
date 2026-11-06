"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ChildrenBranch } from "@/lib/children";

/** Church selector for the Kids home page; changes the `branchId` query and keeps the rest. */
export function BranchSwitcher({
  branches,
  value,
  label,
}: {
  branches: ChildrenBranch[];
  value: string;
  label: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  if (branches.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="children-muted whitespace-nowrap">{label}</span>
      <select
        className="children-input !min-h-10 !w-auto !py-1.5 text-sm"
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set("branchId", event.target.value);
          next.delete("page");
          next.delete("sessionPage");
          start(() => router.push(`/children?${next}`));
        }}
      >
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
