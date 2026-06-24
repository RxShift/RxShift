"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label, Select } from "@/components/ui/form";

interface LocationOption {
  id: string;
  name: string;
}

function download(url: string) {
  window.location.href = url;
}

export default function ReportCards({
  locations,
  isOwner,
  defaultFrom,
  defaultTo,
}: {
  locations: LocationOption[];
  isOwner: boolean;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [clFrom, setClFrom] = useState(defaultFrom);
  const [clTo, setClTo] = useState(defaultTo);
  const [clLocation, setClLocation] = useState("");
  const [auFrom, setAuFrom] = useState(defaultFrom);
  const [auTo, setAuTo] = useState(defaultTo);

  // Flexible schedule export
  const [seFrom, setSeFrom] = useState(defaultFrom);
  const [seTo, setSeTo] = useState(defaultTo);
  const [seLocs, setSeLocs] = useState<Set<string>>(new Set());

  const toggleSeLoc = (id: string) =>
    setSeLocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const seLocParam =
    seLocs.size === 0 || seLocs.size === locations.length
      ? "all"
      : [...seLocs].join(",");
  const scheduleQuery = `from=${seFrom}&to=${seTo}&locations=${seLocParam}`;
  const rangeValid = seFrom && seTo && seFrom <= seTo;

  return (
    <div className="grid max-w-[1040px] gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Schedule export
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          Any date range, one or more locations, as a spreadsheet — staff, role,
          location, day, times, hours, work type, break, a compliance check, and
          any flags, plus summary tabs of total hours by staff and by location.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="se-from">From</Label>
              <Input
                id="se-from"
                type="date"
                value={seFrom}
                onChange={(e) => setSeFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label htmlFor="se-to">To</Label>
              <Input
                id="se-to"
                type="date"
                value={seTo}
                onChange={(e) => setSeTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
          {locations.length > 1 && (
            <div>
              <Label>Locations</Label>
              <div className="flex flex-wrap gap-3">
                {locations.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-1.5 font-body text-sm text-navy"
                  >
                    <input
                      type="checkbox"
                      checked={seLocs.has(l.id)}
                      onChange={() => toggleSeLoc(l.id)}
                      className="h-4 w-4 accent-amber"
                    />
                    {l.name}
                  </label>
                ))}
              </div>
              <HelpText>Leave all unchecked for every location.</HelpText>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!rangeValid}
              onClick={() => download(`/api/reports/schedule-range?${scheduleQuery}`)}
            >
              Download .xlsx
            </Button>
            <Button
              variant="secondary"
              disabled={!rangeValid}
              onClick={() =>
                window.open(`/app/reports/print?${scheduleQuery}`, "_blank")
              }
            >
              Print view
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          Compliance Record
        </h2>
        <p className="mt-1 font-body text-sm text-steel">
          The immutable, hour-by-hour record of what actually happened —
          pharmacists, technicians (CPhT flagged), required ratio, and every
          deficiency. Board-ready.
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
          Everyone on the roster: role, certification, ratio exclusion,
          employment, home location, emails, and active/offboarded status.
        </p>
        <div className="mt-4">
          <Button onClick={() => download("/api/reports/staff")}>
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
