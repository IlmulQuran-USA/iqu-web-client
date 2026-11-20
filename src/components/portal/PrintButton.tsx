"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Opens the browser's print dialog (Print or Save as PDF). Hidden when printing. */
export function PrintButton() {
  return (
    <Button
      variant="secondary"
      onClick={() => window.print()}
      iconStart={<Printer aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      className="print:hidden"
    >
      Print or save as PDF
    </Button>
  );
}
