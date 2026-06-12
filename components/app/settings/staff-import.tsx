"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Label, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  normalizeEmploymentType,
  normalizeRatioType,
  parseCsv,
} from "@/lib/csv";
import { importStaff } from "@/lib/actions/staff";
import { aiMapCsvColumns } from "@/lib/actions/import";
import type { Location } from "@/lib/types";

const TARGET_FIELDS = [
  { value: "", label: "— Skip this column —" },
  { value: "full_name", label: "Full name (required)" },
  { value: "login_email", label: "Login email" },
  { value: "work_email", label: "Work email" },
  { value: "job_title", label: "Job title" },
  { value: "ratio_type", label: "Ratio type (pharmacist / technician / non-counting)" },
  { value: "employment_type", label: "Employment type" },
];

export default function StaffImport({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [homeLocation, setHomeLocation] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setBusy(true);
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setResult("That file needs a header row plus at least one person.");
      setBusy(false);
      return;
    }
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));
    // AI maps the columns automatically; the dropdowns below let you correct it
    const aiResult = await aiMapCsvColumns(parsed[0], parsed.slice(1, 4));
    setMapping(
      aiResult.ok && aiResult.data
        ? aiResult.data.mapping
        : parsed[0].map(() => "")
    );
    setBusy(false);
  }

  async function handleImport() {
    setBusy(true);
    setResult(null);
    const nameIdx = mapping.indexOf("full_name");
    if (nameIdx === -1) {
      setResult("Map at least one column to Full name.");
      setBusy(false);
      return;
    }

    const records = rows.map((row) => {
      const rec: Record<string, string | null> = {
        full_name: "",
        login_email: null,
        work_email: null,
        job_title: null,
        ratio_type: "technician",
        employment_type: "full_time",
      };
      mapping.forEach((field, i) => {
        if (!field) return;
        const raw = (row[i] ?? "").trim();
        if (!raw) return;
        if (field === "ratio_type") rec.ratio_type = normalizeRatioType(raw);
        else if (field === "employment_type")
          rec.employment_type = normalizeEmploymentType(raw);
        else rec[field] = raw;
      });
      return rec;
    });

    const res = await importStaff(records, homeLocation || null);
    if (res.ok && res.data) {
      setResult(
        `Imported ${res.data.imported} people${res.data.skipped ? ` (${res.data.skipped} rows skipped)` : ""}.`
      );
      setRows([]);
      setHeaders([]);
      router.refresh();
    } else if (!res.ok) {
      setResult(res.error);
    }
    setBusy(false);
  }

  return (
    <div className="max-w-[840px] space-y-6">
      <Card>
        <h2 className="mb-1 font-brand text-base font-bold text-navy">
          Import staff from a spreadsheet
        </h2>
        <p className="mb-4 font-body text-sm text-steel">
          Export your roster to CSV (Excel: File → Save As → CSV), upload it,
          map the columns once, and import. Up to 500 people per file.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block font-body text-sm text-steel file:mr-4 file:rounded-md file:border-0 file:bg-amber file:px-4 file:py-2 file:font-brand file:text-sm file:font-bold file:text-white hover:file:bg-amber-dark"
        />
        {locations.length > 0 && (
          <div className="mt-4 max-w-[280px]">
            <Label htmlFor="home-loc">Home location for imported staff</Label>
            <Select
              id="home-loc"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.target.value)}
            >
              <option value="">— None —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      {headers.length > 0 && (
        <Card>
          <h3 className="mb-1 font-brand text-sm font-bold text-navy">
            Column mapping
          </h3>
          <p className="mb-3 font-body text-xs text-steel">
            AI mapped your columns automatically — correct anything it got
            wrong before importing.
          </p>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {headers.map((h, i) => (
              <div key={i}>
                <Label>&ldquo;{h}&rdquo; →</Label>
                <Select
                  value={mapping[i] ?? ""}
                  onChange={(e) => {
                    const next = [...mapping];
                    next[i] = e.target.value;
                    setMapping(next);
                  }}
                >
                  {TARGET_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <h3 className="mb-2 font-brand text-sm font-bold text-navy">
            Preview ({rows.length} people)
          </h3>
          <Table>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <Th key={i}>{mapping[i] || "(skipped)"}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, ri) => (
                <Tr key={ri}>
                  {row.map((cell, ci) => (
                    <Td key={ci} className={mapping[ci] ? "" : "text-steel/50"}>
                      {cell}
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
          {rows.length > 5 && (
            <HelpText>…and {rows.length - 5} more rows.</HelpText>
          )}

          <div className="mt-5 border-t border-line pt-5">
            <Button onClick={handleImport} disabled={busy}>
              {busy ? "Importing…" : `Import ${rows.length} people`}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <p
          className={`font-body text-sm ${result.startsWith("Imported") ? "text-[#2E7D5E]" : "text-[#C0392B]"}`}
        >
          {result}
        </p>
      )}
    </div>
  );
}
