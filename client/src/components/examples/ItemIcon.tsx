import { ItemIcon } from "../ItemIcon";

export default function ItemIconExample() {
  return (
    <div className="flex gap-4">
      <ItemIcon itemName="Abyssal whip" size="sm" />
      <ItemIcon itemName="Dragon platebody" size="md" />
      <ItemIcon itemName="Armadyl crossbow" size="lg" />
    </div>
  );
}
