/**
 * Saved Scanner filters and their Discord alerts, in one dialog.
 *
 * A preset is the Scanner's whole filter state as JSON (PresetFilters). Flip its alert on and
 * the server re-runs it every N minutes and posts matches to Discord — see
 * server/scannerAlerts.ts. Everything here is a thin form over /api/scanner/presets.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Loader2, Play, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SCANNER_ALERT_INTERVALS, SCANNER_ALERT_MAX_TOP_N, type PresetFilters } from "@shared/scannerPipeline";
import type { ScannerPreset } from "@shared/schema";

const PRESETS_KEY = ["/api/scanner/presets"];

const intervalLabel = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : "24 h");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: PresetFilters;
  onLoad: (filters: PresetFilters) => void;
}

export function ScannerPresets({ open, onOpenChange, currentFilters, onLoad }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");

  const { data: presets = [], isLoading } = useQuery<ScannerPreset[]>({ queryKey: PRESETS_KEY, enabled: open });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: PRESETS_KEY });
  const fail = (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/scanner/presets", { name, filters: currentFilters }),
    onSuccess: () => { setName(""); invalidate(); toast({ title: "Filter saved" }); },
    onError: fail,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Saved filters & alerts
          </DialogTitle>
          <DialogDescription>
            Save the filters you have on screen, reload them later, or turn one into a Discord alert.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
        >
          <Input
            placeholder="Name for the current filters"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            data-testid="input-preset-name"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="button-save-preset">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save current filters"}
          </Button>
        </form>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto my-6" />
        ) : presets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center my-6">No saved filters yet.</p>
        ) : (
          <div className="space-y-3">
            {presets.map((p) => (
              <PresetRow key={p.id} preset={p} onLoad={() => { onLoad(p.filters); onOpenChange(false); }} onChanged={invalidate} onError={fail} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type AlertFields = Pick<ScannerPreset, "alertEnabled" | "intervalMinutes" | "mode" | "topN" | "webhookUrl">;

function PresetRow({ preset, onLoad, onChanged, onError }: {
  preset: ScannerPreset;
  onLoad: () => void;
  onChanged: () => void;
  onError: (e: Error) => void;
}) {
  const { toast } = useToast();
  // Local draft so typing a webhook URL does not PATCH on every keystroke.
  const [draft, setDraft] = useState<AlertFields>({
    alertEnabled: preset.alertEnabled,
    intervalMinutes: preset.intervalMinutes,
    mode: preset.mode,
    topN: preset.topN,
    webhookUrl: preset.webhookUrl,
  });
  const set = <K extends keyof AlertFields>(k: K, v: AlertFields[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = (Object.keys(draft) as (keyof AlertFields)[]).some((k) => draft[k] !== preset[k]);

  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/scanner/presets/${preset.id}`, draft),
    onSuccess: () => { onChanged(); toast({ title: "Alert saved" }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/scanner/presets/${preset.id}`),
    onSuccess: onChanged,
    onError,
  });
  const test = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/scanner/presets/${preset.id}/test`)).json() as Promise<{ sent: boolean; matched: number }>,
    onSuccess: (r) => {
      onChanged();
      toast({
        title: r.sent ? "Sent to Discord" : "Nothing sent",
        description: `${r.matched} item${r.matched === 1 ? "" : "s"} match this filter right now.${r.sent ? "" : " Check the webhook or DISCORD_WEBHOOK_URL."}`,
      });
    },
    onError,
  });

  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-testid={`preset-${preset.id}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium flex-1 truncate">{preset.name}</span>
        {preset.lastRunAt && (
          <span className="text-xs text-muted-foreground">
            last run {new Date(preset.lastRunAt).toLocaleString()}
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onLoad} data-testid="button-load-preset">
          <Play className="h-3.5 w-3.5 mr-1" /> Load
        </Button>
        <Button size="icon" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label="Delete preset">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div className="flex items-center gap-2 h-9">
          <Switch checked={draft.alertEnabled} onCheckedChange={(v) => set("alertEnabled", v)} id={`en-${preset.id}`} />
          <Label htmlFor={`en-${preset.id}`}>Discord alert</Label>
        </div>
        <div>
          <Label className="text-xs">Every</Label>
          <Select value={String(draft.intervalMinutes)} onValueChange={(v) => set("intervalMinutes", Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCANNER_ALERT_INTERVALS.map((m) => <SelectItem key={m} value={String(m)}>{intervalLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Send</Label>
          <Select value={draft.mode} onValueChange={(v) => set("mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Only new matches</SelectItem>
              <SelectItem value="summary">Top N summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Max items</Label>
          <Input
            type="number" min={1} max={SCANNER_ALERT_MAX_TOP_N}
            value={draft.topN}
            onChange={(e) => set("topN", Math.max(1, Math.min(SCANNER_ALERT_MAX_TOP_N, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Webhook URL (blank = default channel)</Label>
          <Input
            placeholder="https://discord.com/api/webhooks/…"
            value={draft.webhookUrl ?? ""}
            onChange={(e) => set("webhookUrl", e.target.value || null)}
          />
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-alert">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save alert"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => test.mutate()} disabled={dirty || test.isPending} title={dirty ? "Save first" : "Run now and post to Discord"} data-testid="button-test-alert">
          {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" /> Send test</>}
        </Button>
      </div>
    </div>
  );
}
