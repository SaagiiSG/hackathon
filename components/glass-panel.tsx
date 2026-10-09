import { cn } from "cn";

// Liquid glass surface for the floating control layer (see `glass` in globals.css).
// Use it for panels that float over the town, not for content cards.
export function GlassPanel({
  className,
  variant = "regular",
  ...props
}: React.ComponentProps<"div"> & { variant?: "regular" | "clear" }) {
  return (
    <div
      data-slot="glass-panel"
      className={cn(
        "flex flex-col rounded-2xl text-card-foreground",
        variant === "clear" ? "glass-clear" : "glass",
        className,
      )}
      {...props}
    />
  );
}
