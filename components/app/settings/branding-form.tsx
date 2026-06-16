"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label } from "@/components/ui/form";
import { updateBranding, uploadLogo } from "@/lib/actions/settings";
import type { Tenant } from "@/lib/types";

const RXSHIFT_AMBER = "#F07C30";

export default function BrandingForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [color, setColor] = useState(
    tenant.branding?.primary_color ?? RXSHIFT_AMBER
  );
  const [logoUrl, setLogoUrl] = useState(tenant.branding?.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("file", f, f.name);
    const result = await uploadLogo(fd);
    setUploading(false);
    if (result.ok) {
      if (result.data) setLogoUrl(result.data.url);
      setMessage("Logo uploaded.");
      router.refresh();
    } else {
      setMessage(result.error);
    }
  }

  async function save(reset: boolean) {
    setSaving(true);
    setMessage(null);
    const result = await updateBranding(
      reset ? {} : { primary_color: color, logo_url: logoUrl.trim() || null }
    );
    setMessage(result.ok ? "Saved." : result.error);
    setSaving(false);
    if (result.ok) {
      if (reset) {
        setColor(RXSHIFT_AMBER);
        setLogoUrl("");
      }
      router.refresh();
    }
  }

  return (
    <Card className="mt-8">
      <h2 className="mb-1 font-brand text-base font-bold text-navy">Branding</h2>
      <p className="mb-5 font-body text-sm text-steel">
        Add your pharmacy&rsquo;s accent color and logo. RxShift stays clearly
        branded — your color applies to buttons, active navigation, and
        highlights, and the RxShift mark always appears in the sidebar. Works in
        both light and dark mode.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="brand-color">Accent color</Label>
          <div className="flex items-center gap-3">
            <input
              id="brand-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-line bg-surface"
            />
            <span className="font-body text-sm text-steel">{color}</span>
          </div>
          <HelpText>Used for buttons, active navigation, and highlights.</HelpText>
        </div>

        <div>
          <Label htmlFor="logo-url">Logo</Label>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Tenant logo"
              className="mb-2 h-12 w-auto rounded border border-line bg-white p-1"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border-[1.5px] border-line bg-surface px-3 py-2 font-body text-sm font-medium text-navy hover:border-steel/40">
              {uploading ? "Uploading…" : "Upload logo file"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={onLogoFile}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl("")}
                className="font-body text-sm text-steel underline-offset-2 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <Input
            id="logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="…or paste a hosted image URL"
            className="mt-2"
          />
          <HelpText>
            Upload a PNG or SVG (or paste a hosted URL). It appears in the sidebar
            next to the RxShift mark, in both light and dark mode.
          </HelpText>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <Button onClick={() => save(false)} disabled={saving}>
          {saving ? "Saving…" : "Save branding"}
        </Button>
        <Button variant="secondary" onClick={() => save(true)} disabled={saving}>
          Reset to RxShift
        </Button>
        {message && (
          <span
            className={`font-body text-sm ${
              message === "Saved." ? "text-compliant" : "text-deficiency"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </Card>
  );
}
