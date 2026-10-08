import { Suspense } from "react";
import { LoginForm } from "./login-form";

// Enterprise split layout: form on the left, brand panel on the right.
export default function LoginPage() {
  return (
    <main className="grid flex-1 md:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
      <aside className="hidden flex-col justify-end gap-4 bg-brand-navy p-12 text-white md:flex">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-brand-yellow" />
          <span className="size-3 rounded-full bg-brand-pink" />
          <span className="size-3 rounded-full bg-brand-teal" />
        </div>
        <p className="max-w-md text-[28px] font-semibold leading-tight">
          One line on why someone should sign in.
        </p>
      </aside>
    </main>
  );
}
