import { Wrench, Sprout, ChefHat, Tent, Package } from "lucide-react";
const icons: Record<string, typeof Wrench> = {
  "Power tools": Wrench,
  Garden: Sprout,
  Kitchen: ChefHat,
  Camping: Tent,
  Other: Package,
};
export function CategoryIcon({
  category,
  size = 30,
}: {
  category: string;
  size?: number;
}) {
  const Icon = icons[category] ?? Package;
  return <Icon size={size} strokeWidth={1.5} />;
}
