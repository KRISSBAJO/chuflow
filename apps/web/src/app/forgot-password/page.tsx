import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(14,116,144,0.18),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-4 py-8">
        <div className="grid w-full gap-7 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[36px] bg-[#040816] p-8 text-white lg:p-10">
            <p className="eyebrow !text-orange-300">Account Recovery</p>
            <h1 className="heading mt-4 text-5xl font-semibold leading-[0.95]">
              Secure access without support tickets.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Generate a reset link, choose a new password, and sign back in to continue ministry work.
            </p>
          </section>
          <div className="flex items-center">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
