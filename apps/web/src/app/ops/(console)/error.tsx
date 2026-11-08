"use client";

import { Button } from "@/components/ui/ui";
import { Notice } from "@/components/ops/ops-ui";

export default function OpsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Notice tone="error" title="This page could not be loaded">
        {error.message || "The control plane did not answer. Check that the ChuFlow API is running with PLATFORM_ENABLED=true."}
      </Notice>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
