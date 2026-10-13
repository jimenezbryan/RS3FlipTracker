import React from "react";
import { Img, staticFile } from "remotion";
import { Search, Star, TrendingUp, ChevronDown, CalendarIcon, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateFlipTax, formatGp } from "@shared/taxCalculator";
import { parseGp } from "@shared/gpParser";
import { DEMO_FLIP, SCANNER_ROWS, SCYTHE_ID } from "../data/items";

// Replica of client/src/pages/Home.tsx: stat tiles, the Log Flip form (FlipForm.tsx) and the
// flip cards (FlipCard.tsx). Tax and profit come from the app's shared/taxCalculator.ts.

const scythe = SCANNER_ROWS.find((r) => r.id === SCYTHE_ID)!;
const short = (price: number) => (price >= 1e9 ? `${(price / 1e9).toFixed(2)}B` : price >= 1e6 ? `${(price / 1e6).toFixed(2)}M` : `${(price / 1e3).toFixed(1)}K`);

// Earlier flips so the dashboard isn't empty. Illustrative; real item names and price levels.
const PAST = [
  { id: 57022, name: "Balarak's sash brush", buy: 97_500_000, sell: 104_000_000 },
  { id: 41106, name: "Cinderbane gloves", buy: 35_200_000, sell: 37_400_000 },
  { id: 28437, name: "Ascension crossbow", buy: 25_400_000, sell: 26_900_000 },
];
const PAST_FLIPS = 24, PAST_PROFIT = 184_220_400, PAST_TAX = 61_480_000;
export const DEMO_TAX = calculateFlipTax(DEMO_FLIP.sellPrice, DEMO_FLIP.buyPrice, DEMO_FLIP.quantity, SCYTHE_ID, "Noxious scythe");

const Caret = () => <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" />;
const SelectBox: React.FC<{ value?: string; placeholder: string }> = ({ value, placeholder }) => (
  <div className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
    <span className={value ? "" : "text-muted-foreground"}>{value ?? placeholder}</span>
    <ChevronDown className="h-4 w-4 opacity-50" />
  </div>
);
/** Looks like <Input> but can show a caret and a focus ring. */
const Field: React.FC<{ text: string; placeholder: string; focused: boolean; mono?: boolean }> = ({ text, placeholder, focused, mono }) => (
  <div className={`flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ${mono ? "font-mono" : ""} ${focused ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}>
    {text ? <span>{text}</span> : !focused && <span className="text-muted-foreground">{placeholder}</span>}
    {focused && <Caret />}
  </div>
);

function FlipCard({ id, name, buy, sell, appear = 1 }: { id: number; name: string; buy: number; sell: number; appear?: number }) {
  const tax = calculateFlipTax(sell, buy, 1, id, name);
  return (
    <Card className="relative overflow-visible" style={{ opacity: appear, transform: `scale(${0.94 + 0.06 * appear})` }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Img src={staticFile(`icons/${id}.gif`)} className="h-14 w-14 shrink-0 rounded-md border object-contain p-2" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{name}</h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>Buy: <span className="font-mono text-foreground">{short(buy)}</span></span>
              <span>Sell: <span className="font-mono text-foreground">{short(sell)}</span></span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className="h-6 bg-success px-2 font-mono text-sm text-success-foreground">+{short(tax.profit)}</Badge>
            <span className="font-mono text-xs text-success">+{tax.roi.toFixed(1)}% ROI</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

export type FormFocus = "item" | "buy" | "sell" | null;

export const DashboardScreen: React.FC<{
  scrollY: number;
  itemText: string;
  suggestions: number; // 0..1 dropdown visibility
  suggestionHover: boolean;
  selected: boolean; // item picked: GE price panel shown
  buyText: string;
  sellText: string;
  focus: FormFocus;
  addPressed: boolean;
  submitted: number; // 0..1 new card + stats
}> = ({ scrollY, itemText, suggestions, suggestionHover, selected, buyText, sellText, focus, addPressed, submitted }) => {
  const buy = parseGp(buyText), sell = parseGp(sellText);
  const tax = buy && sell ? calculateFlipTax(sell, buy, 1, SCYTHE_ID, "Noxious scythe") : null;
  const done = submitted > 0;
  const profit = PAST_PROFIT + (done ? DEMO_TAX.profit * submitted : 0);
  const taxPaid = PAST_TAX + (done ? DEMO_TAX.totalTax * submitted : 0);
  const today = "Oct 12, 2026";
  return (
    <div className="absolute inset-x-0 top-0 bg-background" style={{ transform: `translateY(${-scrollY}px)` }}>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Flips</div>
            <div className="mt-2 text-2xl font-semibold">{PAST_FLIPS + (done ? 1 : 0)}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold">{PAST_FLIPS - 2 + (done ? 1 : 0)}</div>
          </div>
          <div className="rounded-lg border bg-card p-4" style={done ? { boxShadow: `0 0 0 ${2 * (1 - Math.abs(submitted * 2 - 1))}px hsl(145 65% 50% / .6)` } : undefined}>
            <div className="text-sm text-muted-foreground">Total Profit</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-success">+{Math.round(profit).toLocaleString()}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">-{Math.round(taxPaid).toLocaleString()} tax paid</div>
          </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-lg">Log Flip</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1"><Field text={itemText} placeholder="Start typing to search..." focused={focus === "item"} /></div>
                      <Button type="button" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
                    </div>
                    {suggestions > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg" style={{ opacity: suggestions, transform: `translateY(${(1 - suggestions) * -6}px)` }}>
                        {[{ id: scythe.id, name: scythe.name }, { id: -1, name: "Noxious staff" }, { id: -2, name: "Noxious longbow" }].map((item, i) => (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-2" style={i === 0 && suggestionHover ? { background: "var(--elevate-1)" } : undefined}>
                            <div className="flex flex-1 items-center gap-3 text-left">
                              {i === 0 ? <Img src={staticFile(`icons/${item.id}.gif`)} className="h-6 w-6 object-contain" /> : <div className="h-6 w-6 rounded bg-muted" />}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{item.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{i === 0 ? `${scythe.buyPrice.toLocaleString()} gp` : "N/A gp"}</div>
                              </div>
                            </div>
                            <Star className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Trade Type</Label>
                  <div className="flex overflow-hidden rounded-md border">
                    <div className="flex-1 bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">GE Trade</div>
                    <div className="flex-1 border-l bg-background px-3 py-2 text-center text-sm font-medium text-muted-foreground">Street Trade</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Category</Label><SelectBox value={selected ? "Weapons" : undefined} placeholder="Select category..." /></div>
                  <div className="space-y-2"><Label className="flex items-center gap-1"><Tag className="h-3 w-3" />Strategy</Label><SelectBox placeholder="Select strategy..." /></div>
                </div>

                {selected && (
                  <div className="rounded-md border bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <Img src={staticFile(`icons/${SCYTHE_ID}.gif`)} className="h-8 w-8 object-contain" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /><span className="text-sm font-medium">GE Price</span></div>
                        <div className="font-mono text-lg font-semibold text-success">{scythe.buyPrice.toLocaleString()} gp</div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>Vol: {scythe.volume.toLocaleString()}</span>
                          <span>Limit: {scythe.geLimit.toLocaleString()}</span>
                          <Badge variant="secondary" className="h-5 text-xs">Members</Badge>
                        </div>
                      </div>
                      <Star className="mr-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div className="space-y-2"><Label>Quantity</Label><Input readOnly value="1" className="font-mono" /></div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Buy Price</Label>
                      {selected && <span className="px-2 py-0.5 text-xs font-medium">Use GE</span>}
                    </div>
                    <Field text={buyText} placeholder="e.g. 4.3b, 500m, 100k" focused={focus === "buy"} mono />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Sell Price</Label>
                      {selected && <span className="px-2 py-0.5 text-xs font-medium">Use GE</span>}
                    </div>
                    <Field text={sellText} placeholder="e.g. 4.4b, 550m, 120k" focused={focus === "sell"} mono />
                    {tax && (
                      <div className="space-y-1 text-xs" id="tax-preview">
                        <div className="flex justify-between text-muted-foreground"><span>Tax (2%):</span><span className="font-mono text-destructive">-{formatGp(tax.totalTax)} gp</span></div>
                        <div className="flex justify-between font-medium"><span>Net Received:</span><span className="font-mono text-success">{formatGp(tax.netSellTotal)} gp</span></div>
                        <div className="flex justify-between"><span>Profit:</span><span className={`font-mono font-semibold ${tax.profit >= 0 ? "text-success" : "text-destructive"}`}>{tax.profit >= 0 ? "+" : ""}{formatGp(tax.profit)} gp</span></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Buy Date</Label><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{today}</Button></div>
                  <div className="space-y-2"><Label>Sell Date</Label><Button variant="outline" className={`w-full justify-start text-left font-normal ${sellText ? "" : "text-muted-foreground"}`}><CalendarIcon className="mr-2 h-4 w-4" />{sellText ? today : "Select date"}</Button></div>
                </div>

                <Button className="w-full" style={addPressed ? { filter: "brightness(1.2)", transform: "scale(0.995)" } : undefined}>Add Flip</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {done && <FlipCard id={SCYTHE_ID} name="Noxious scythe" buy={DEMO_FLIP.buyPrice} sell={DEMO_FLIP.sellPrice} appear={submitted} />}
            {PAST.slice(0, done ? 2 : 3).map((f) => <FlipCard key={f.id} id={f.id} name={f.name} buy={f.buy} sell={f.sell} />)}
          </div>
        </div>
      </main>
    </div>
  );
};
