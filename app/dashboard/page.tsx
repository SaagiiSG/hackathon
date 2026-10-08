import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:px-8">
        <span className="font-semibold">Hackathon</span>
        <Suspense fallback={<span className="h-8 w-40" />}>
          <UserMenu />
        </Suspense>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8">
        <Card className="bg-card-tint-lavender">
          <CardHeader>
            <CardTitle>You&apos;re in</CardTitle>
            <CardDescription>Auth works. Build the first feature here.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate">
            Start with AGENTS.md: grill → feature.md + design-spec.md → go-ahead → build.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// Reads the session, so it streams in behind the Suspense boundary above.
async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{user.email}</span>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
