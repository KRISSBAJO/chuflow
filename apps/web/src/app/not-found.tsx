import { StatusShell } from "@/components/auth/auth-shell";

export default function NotFoundPage() {
  return (
    <StatusShell
      label="Error 404"
      title="We couldn't find that page."
      body="The link may be mistyped or out of date, or it may belong to a branch, district or form that has been renamed."
      actions={[
        { label: "Open dashboard", href: "/dashboard", primary: true },
        { label: "Back to home", href: "/" },
      ]}
    />
  );
}
