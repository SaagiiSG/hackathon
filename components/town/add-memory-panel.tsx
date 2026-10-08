"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fromDay, fullDay, toDay, today } from "@/lib/town/dates";
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
  const [pickingDay, setPickingDay] = useState(false);

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
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] gap-5 overflow-y-auto sm:max-w-md"
        showCloseButton={!saving}
        onInteractOutside={(e) => saving && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-ink">Add a memory</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2" disabled={saving}>
            <legend className="mb-2 text-sm font-medium text-ink">Who was there?</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              value={kind}
              onValueChange={(v) => v && setKind(v as MemoryKind)}
              className="grid w-full grid-cols-2"
              aria-label="Who was there?"
            >
              <ToggleGroupItem value="shared" className="h-10 w-full">
                With friends
              </ToggleGroupItem>
              <ToggleGroupItem value="solo" className="h-10 w-full">
                Just me
              </ToggleGroupItem>
            </ToggleGroup>
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
            <Textarea
              id="memory-body"
              value={body}
              maxLength={2000}
              disabled={saving}
              rows={3}
              placeholder={photo ? "What's going on in this photo?" : "Who was there, what was funny, what you want to remember."}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="memory-day">When was it?</Label>
            <Popover open={pickingDay} onOpenChange={setPickingDay}>
              <PopoverTrigger asChild>
                <Button id="memory-day" type="button" variant="outline" className="h-11 justify-start" disabled={saving}>
                  <CalendarDays />
                  {fullDay(day)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDay(day)}
                  defaultMonth={fromDay(day)}
                  captionLayout="dropdown"
                  disabled={{ after: new Date() }}
                  onSelect={(date) => {
                    if (!date) return;
                    setDay(toDay(date));
                    setDayFromPhoto(false);
                    setPickingDay(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            {dayFromPhoto && <p className="text-[13px] text-steel">Date taken from your photo: {fullDay(day)}.</p>}
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" className="h-10" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 px-4" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Adding…" : "Add to town"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
