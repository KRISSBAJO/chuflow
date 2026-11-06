"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
export function ActionNotice(props: {
  message: string;
  param?: string;
  description?: string;
  cleanup?: string[];
  id?: string;
}) {
  return (
    <Suspense fallback={null}>
      <ActionNoticeEffect {...props} />
    </Suspense>
  );
}
function ActionNoticeEffect({
  message,
  param = "saved",
  description,
  cleanup = [],
  id,
}: {
  message: string;
  param?: string;
  description?: string;
  cleanup?: string[];
  id?: string;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const trigger = params.get(param);
  // Consume only this action's transient flags. Preserve filters, pagination, fragments and router state.
  const cleanupKeys = cleanup.join(",");
  useEffect(() => {
    if (!trigger) return;
    const url = new URL(window.location.href);
    if (url.pathname !== pathname || url.searchParams.get(param) !== trigger)
      return;
    toast.success(message, {
      id: id || `action:${pathname}:${param}:${trigger}`,
      description,
    });
    url.searchParams.delete(param);
    for (const key of cleanupKeys.split(",").filter(Boolean))
      url.searchParams.delete(key);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, [trigger, pathname, param, message, description, cleanupKeys, id]);
  return null;
}
