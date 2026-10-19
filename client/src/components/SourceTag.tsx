import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SOURCES, type SourceKey } from "@shared/priceSources";

/** Small "where this number comes from" tag. The tooltip carries the longer explanation. */
export function SourceTag({ source, className = "" }: { source: SourceKey; className?: string }) {
  const s = SOURCES[source];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80 border border-border rounded px-1 align-middle cursor-help ${className}`}
          data-testid={`source-tag-${source}`}
        >
          {s.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{s.detail}</TooltipContent>
    </Tooltip>
  );
}
