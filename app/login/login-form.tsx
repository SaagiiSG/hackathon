"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const next = useSearchParams().get("next") ?? "";
  const urlError = useSearchParams().get("error");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    {}
  );
  const error = state.error ?? (urlError ? "Sign-in failed. Try again." : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to continue." : "It takes ten seconds."}
        </p>
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {state.message && <p className="text-sm text-success">{state.message}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-medium text-link-blue hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
