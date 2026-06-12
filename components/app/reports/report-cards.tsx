"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label, Select } from "@/components/ui/form";

interface PeriodOption {
  id: string;
  label: string;
}
interface LocationOption {
  id: string;
  name: string;
}

function download(url: string) {
  window.location.href = url;
}

export default function ReportCards({
  locations,
  periods,
  isOwner,
  defaultFrom,
  defaultTo,
}: {
  locations: LocationOption[];
  periods: PeriodOption[];
  isOwner: boolean;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [clFrom, setClFrom] = useState(defaultFrom);
  const [clTo, setClTo] = useState(defaultTo);
  const [clLocation, setClLocation] = useState("");
  const [schedulePeriod, setSchedulePeriod] = useState(periods[0]?.id ?? "");
  const [auFrom, setAuFrom] = useState(defaultFrom);
  const [auTo, setAuTo] = useState(defaultTo);

  return (
    <div className="grid max-w-[1040px] gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Compliance log
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          The hourly staffing record — pharmacists, technicians (CPhT
          flagged), required ratio, and every deficiency. Board-ready.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="cl-from">From</Label>
            <Input id="cl-from" type="date" value={clFrom} onChange={(e) => setClFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label htmlFor="cl-to">To</Label>
            <Input id="cl-to" type="date" value={clTo} onChange={(e) => setClTo(e.target.value)} className="w-40" />
          </div>
          <div className="min-w-44">
            <Label htmlFor="cl-loc">Location</Label>
            <Select id="cl-loc" value={clLocation} onChange={(e) => setClLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={() =>
              download(
                `/api/reports/compliance-log?from=${clFrom}&to=${clTo}${clLocation ? `&location_id=${clLocation}` : ""}`
              )
            }
          >
            Download .xlsx
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Staff roster
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          Everyone on the roster: role, certification, employment, home
          location, emails, and active/offboarded status.
        </p>
        <div className="mt-4">
          <Button onClick={() => download("/api/reports/staff")}>
            Download .xlsx
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Schedule export
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          One schedule period as a spreadsheet — who works when, with times
          and unpaid breaks.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <Label htmlFor="se-period">Period</Label>
            <Select
              id="se-period"
              value={schedulePeriod}
              onChange={(e) => setSchedulePeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            disabled={!schedulePeriod}
            onClick={() =>
              download(`/api/reports/schedule?period_id=${schedulePeriod}`)
            }
          >
            Download .xlsx
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Audit report
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          The append-only activity trail — who did what, when: schedule
          changes, approvals, publishes, overrides, offboarding.
        </p>
        {isOwner ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="au-from">From</Label>
              <Input id="au-from" type="date" value={auFrom} onChange={(e) => setAuFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label htmlFor="au-to">To</Label>
              <Input id="au-to" type="date" value={auTo} onChange={(e) => setAuTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => download(`/api/reports/audit?from=${auFrom}&to=${auTo}`)}>
              Download .xlsx
            </Button>
          </div>
        ) : (
          <HelpText>Available to Owner/Admin accounts.</HelpText>
        )}
      </Card>
    </div>
  );
}
