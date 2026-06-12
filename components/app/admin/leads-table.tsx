"use client";

import { useState } from "react";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { Input } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { Lead, LeadStage } from "@/lib/types";

export const STAGE_TONES: Record<LeadStage, BadgeTone> = {
  Lead: "neutral",
  Demo: "alert",
  Trial: "alert",
  Active: "compliant",
  Churned: "deficiency",
};

function fmtWhen(iso: string): string {
  return iso.slice(0, 10);
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState("");

  const visible = leads.filter((l) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      l.pharmacy_name.toLowerCase().includes(q) ||
      (l.contact_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1040px]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="w-72">
          <Input
            placeholder="Filter by pharmacy or contact…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Link href="/app/admin/leads/new">
          <Button>Add Lead</Button>
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message={
            leads.length === 0
              ? "No leads yet. Website demo requests land here automatically — or add one by hand."
              : "No leads match that filter."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Pharmacy</Th>
              <Th>Locations</Th>
              <Th>Contact</Th>
              <Th>Stage</Th>
              <Th>Source</Th>
              <Th>State</Th>
              <Th>Last updated</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <Tr key={l.id}>
                <Td className="font-medium">
                  <Link
                    href={`/app/admin/leads/${l.id}`}
                    className="text-navy underline-offset-2 hover:underline"
                  >
                    {l.pharmacy_name}
                  </Link>
                </Td>
                <Td>{l.location_count ?? "—"}</Td>
                <Td>
                  {l.contact_name ?? "—"}
                  {l.contact_email && (
                    <div className="font-body text-xs text-steel">
                      {l.contact_email}
                    </div>
                  )}
                </Td>
                <Td>
                  <Badge tone={STAGE_TONES[l.stage]}>{l.stage}</Badge>
                </Td>
                <Td>{l.source}</Td>
                <Td>{l.state ?? "—"}</Td>
                <Td>{fmtWhen(l.updated_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
