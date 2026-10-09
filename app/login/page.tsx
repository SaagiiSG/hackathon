import { Suspense } from "react";
import { GlassPanel } from "@/components/glass-panel";
import { LoginForm } from "./login-form";

// Glass sign-in card floating over soft town-colored light.
export default function LoginPage() {
  return (
    <main className="relative grid flex-1 place-items-center overflow-hidden bg-card-tint-mint px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 size-[28rem] rounded-full bg-card-tint-sky blur-3xl" />
        <div className="absolute top-1/3 -right-32 size-[30rem] rounded-full bg-card-tint-lavender blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 size-[26rem] rounded-full bg-brand-teal/25 blur-3xl" />
        <div className="absolute top-16 right-1/4 size-40 rounded-full bg-brand-yellow/40 blur-2xl" />
      </div>
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-brand-yellow" />
          <span className="size-3 rounded-full bg-brand-pink" />
          <span className="size-3 rounded-full bg-brand-teal" />
          <span className="ml-1 text-sm font-semibold text-ink">Memotown</span>
        </div>
        <GlassPanel className="w-full rounded-3xl px-6 py-7">
          <Suspense>
            <LoginForm />
          </Suspense>
        </GlassPanel>
        <p className="text-sm font-medium text-charcoal">Every hangout adds a floor.</p>
      </div>
    </main>
  );
}
