import { FlipTable } from "../FlipTable";

// todo: remove mock functionality
const mockFlips = [
  {
    id: "1",
    itemName: "Abyssal whip",
    buyPrice: 2500000,
    sellPrice: 2750000,
    buyDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    sellDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "2",
    itemName: "Dragon platebody",
    buyPrice: 1200000,
    sellPrice: 1150000,
    buyDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    sellDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "3",
    itemName: "Armadyl crossbow",
    buyPrice: 8500000,
    buyDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export default function FlipTableExample() {
  const handleDelete = (id: string) => {
    console.log("Delete flip:", id);
  };

  return (
    <div className="w-full">
      <FlipTable flips={mockFlips} onDelete={handleDelete} />
    </div>
  );
}
