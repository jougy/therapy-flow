import React from "react";

export const PlatformInfoGrid = ({ items }: { items: Array<[string, string]> }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {items.map(([label, value]) => (
      <div key={label} className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    ))}
  </div>
);
