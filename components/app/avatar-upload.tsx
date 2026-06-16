"use client";

// Avatar upload with a 1:1 crop. Pick a photo, position/zoom it in a square
// crop, and it uploads to the private avatars bucket (manager-only via RLS) and
// saves the path on the staff record.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { setStaffAvatar } from "@/lib/actions/staff";
import Avatar from "./avatar";

async function cropToWebp(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load that image."));
    i.src = src;
  });
  const out = 400; // stored square size — keeps files tiny
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available.");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, out, out);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not crop the image."))),
      "image/webp",
      0.85
    )
  );
}

export default function AvatarUpload({
  staffId,
  tenantId,
  fullName,
  currentUrl,
}: {
  staffId: string;
  tenantId: string;
  fullName: string;
  currentUrl?: string | null;
}) {
  const router = useRouter();
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback(
    (_: Area, areaPixels: Area) => setArea(areaPixels),
    []
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setError(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setSrc(URL.createObjectURL(f));
    }
    e.target.value = ""; // allow re-picking the same file
  }

  async function save() {
    if (!src || !area) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToWebp(src, area);
      const supabase = createClient();
      const path = `${tenantId}/${staffId}-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const result = await setStaffAvatar(staffId, path);
      if (!result.ok) throw new Error(result.error);
      setSrc(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar url={currentUrl} name={fullName} size={48} />
      <label className="cursor-pointer font-body text-sm font-medium text-navy underline-offset-2 hover:underline">
        {currentUrl ? "Change photo" : "Add photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
      </label>

      <Modal
        open={!!src}
        onClose={() => setSrc(null)}
        title="Crop photo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSrc(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save photo"}
            </Button>
          </>
        }
      >
        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-cloud">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-3 w-full accent-amber"
          aria-label="Zoom"
        />
        {error && (
          <p className="mt-2 font-body text-sm text-deficiency">{error}</p>
        )}
      </Modal>
    </div>
  );
}
