"use client";

import { Button } from "@ritzy-studio/ui";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} type="button">
      Print or save PDF
    </Button>
  );
}
