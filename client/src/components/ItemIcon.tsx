import { Package } from "lucide-react";

interface ItemIconProps {
  itemName: string;
  itemIcon?: string;
  size?: "sm" | "md" | "lg";
}

export function ItemIcon({ itemName, itemIcon, size = "md" }: ItemIconProps) {
  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-14 w-14",
    lg: "h-16 w-16",
  };

  const iconSize = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-8 w-8",
  };

  if (itemIcon) {
    return (
      <img
        src={itemIcon}
        alt={itemName}
        className={`${sizeClasses[size]} rounded-md border object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-md border bg-muted`}>
      <Package className={`${iconSize[size]} text-muted-foreground`} />
    </div>
  );
}
