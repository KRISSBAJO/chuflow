import { StatusShell } from "@/components/auth/auth-shell";

export default function UnauthorizedPage() {
  return (
    <StatusShell
      label="Access restricted"
      title="This area isn't part of your role."
      body="You're signed in, but this page is outside the permissions assigned to your account. Ask an administrator if you need access."
      actions={[
        { label: "Go to dashboard", href: "/dashboard", primary: true },
        { label: "Switch account", href: "/login" },
      ]}
    />
  );
}
