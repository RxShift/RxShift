"use client";

import Button from "@/components/ui/button";

export default function PrintButton() {
  return <Button onClick={() => window.print()}>Print / Save as PDF</Button>;
}
