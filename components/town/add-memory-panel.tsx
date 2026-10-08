"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fullDay, today } from "@/lib/town/dates";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, photoDate, saveMemory } from "@/lib/town/client";
import type { Memory, MemoryKind, Town, Viewer } from "@/lib/town/types";

export function AddMemoryPanel({
  town,
  viewer,
  month,
  onClose,
  onAdded,
}: {
  town: Town;
  viewer: Viewer;
  month?: string; // preset from "Add a memory to July"
  onClose: () => void;
  onAdded: (memory: Memory) => void;
}) {
  const [kind, setKind] = useState<MemoryKind>("shared");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [day, setDay] = useState(month && `${month}-01` < today() ? `${month}-01` : today());
  const [dayFromPhoto, setDayFromPhoto] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; photo?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const pickPhoto = async (file: File | null) => {
    setErrors((e) => ({ ...e, photo: undefined }));
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, photo: "Photos only: JPG, PNG or WebP." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((e) => ({ ...e, photo: "That photo is over 5 MB. Pick a smaller one." }));
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    const taken = await photoDate(file);
    if (taken) {
      setDay(taken);
      setDayFromPhoto(true);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    setDayFromPhoto(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: "Give it a short title." });
      return;
    }
    setSaving(true);
    try {
      const memory = await saveMemory(town.id, viewer, {
        kind,
        title: title.trim(),
        body: body.trim() || null,
        photo,
        happenedOn: day,
      });
      onAdded(memory);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save that memory. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/25 p-3" onClick={() => !saving && onClose()}>
      <Card
        role="dialog"
        aria-modal
        aria-labelledby="add-memory-title"
        className="w-full max-w-md gap-5 px-5 py-5 shadow-[0_16px_48px_-8px_rgba(15,15,15,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="add-memory-title" className="text-lg font-semibold text-ink">
            Add a memory
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Close">
            <X />
          </Button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2" disabled={saving}>
            <legend className="mb-2 text-sm font-medium text-ink">Who was there?</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={kind === "shared" ? "default" : "outline"}
                aria-pressed={kind === "shared"}
                className="h-10"
                onClick={() => setKind("shared")}
              >
                With friends
              </Button>
              <Button
                type="button"
                variant={kind === "solo" ? "default" : "outline"}
                aria-pressed={kind === "solo"}
                className="h-10"
                onClick={() => setKind("solo")}
              >
                Just me
              </Button>
            </div>
            <p className="text-[13px] text-steel">
              {kind === "shared"
                ? "Shared memories build the city."
                : "Solo memories grow your lodge in the woods."}
            </p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="memory-title">What happened?</Label>
            <Input
              id="memory-title"
              value={title}
              maxLength={80}
              disabled={saving}
              placeholder="Late-night ramen after finals"
              aria-invalid={!!errors.title}
              className="h-11"
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((x) => ({ ...x, title: undefined }));
              }}
            />
            {errors.title && <p className="text-[13px] text-destructive">{errors.title}</p>}
            {title.length > 60 && <p className="text-[13px] text-steel">{80 - title.length} characters left</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="memory-photo">Add a photo (optional)</Label>
            {preview ? (
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={preview} alt="" className="max-h-56 w-full rounded-lg object-cover" />
                <Button type="button" variant="link" className="h-auto self-start p-0" onClick={clearPhoto} disabled={saving}>
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                id="memory-photo"
                type="file"
                accept={PHOTO_TYPES.join(",")}
                disabled={saving}
                className="h-11 py-2.5"
                onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
              />
            )}
            {errors.photo && <p className="text-[13px] text-destructive">{errors.photo}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="memory-body">{photo ? "Add a caption (optional)" : "Tell the story (optional)"}</Label>
            <Input
              id="memory-body"
              value={body}
              maxLength={2000}
              disabled={saving}
              placeholder={photo ? "What's going on in this photo?" : "Who was there, what was funny, what you want to remember."}
              className="h-11"
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="memory-day">When was it?</Label>
            <Input
              id="memory-day"
              type="date"
              value={day}
              max={today()}
              disabled={saving}
              className="h-11"
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value > today() ? today() : e.target.value);
                setDayFromPhoto(false);
              }}
            />
            <p className="text-[13px] text-steel">
              {dayFromPhoto ? `Date taken from your photo: ${fullDay(day)}.` : fullDay(day)}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" className="h-10" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 px-4" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Adding…" : "Add to town"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
