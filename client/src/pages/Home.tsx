import { useState } from "react";
import { Header } from "@/components/Header";
import { FlipForm } from "@/components/FlipForm";
import { FlipTable } from "@/components/FlipTable";

interface Flip {
  id: string;
  itemName: string;
  itemIcon?: string;
  quantity: number;
  buyPrice: number;
  sellPrice?: number;
  buyDate: Date;
  sellDate?: Date;
}

// todo: remove mock functionality
const initialFlips: Flip[] = [
  {
    id: "1",
    itemName: "Abyssal whip",
    quantity: 10,
    buyPrice: 2500000,
    sellPrice: 2750000,
    buyDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    sellDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    itemName: "Dragon platebody",
    quantity: 5,
    buyPrice: 1200000,
    sellPrice: 1150000,
    buyDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    sellDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "3",
    itemName: "Armadyl crossbow",
    quantity: 1,
    buyPrice: 8500000,
    buyDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export default function Home() {
  const [flips, setFlips] = useState<Flip[]>(initialFlips);

  const handleAddFlip = (flipData: {
    itemName: string;
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }) => {
    const newFlip: Flip = {
      id: Date.now().toString(),
      ...flipData,
    };
    setFlips([newFlip, ...flips]);
  };

  const handleDeleteFlip = (id: string) => {
    setFlips(flips.filter((flip) => flip.id !== id));
  };

  const totalProfit = flips.reduce((sum, flip) => {
    if (flip.sellPrice) {
      return sum + (flip.sellPrice - flip.buyPrice) * flip.quantity;
    }
    return sum;
  }, 0);

  const completedFlips = flips.filter((flip) => flip.sellPrice).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Flips</div>
            <div className="mt-2 text-2xl font-semibold" data-testid="text-total-flips">
              {flips.length}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold" data-testid="text-completed-flips">
              {completedFlips}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Profit</div>
            <div
              className={`mt-2 font-mono text-2xl font-semibold ${
                totalProfit > 0 ? "text-success" : totalProfit < 0 ? "text-destructive" : ""
              }`}
              data-testid="text-total-profit"
            >
              {totalProfit > 0 ? "+" : ""}{totalProfit.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <FlipForm onSubmit={handleAddFlip} />
          </div>
          <div className="lg:col-span-2">
            <FlipTable flips={flips} onDelete={handleDeleteFlip} />
          </div>
        </div>
      </main>
    </div>
  );
}
