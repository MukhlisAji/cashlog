const CATEGORY_META: Record<string, string> = {
  Makanan: "#22c55e",
  Transport: "#3b82f6",
  Utilitas: "#f59e0b",
  Belanja: "#8b5cf6",
  Kesehatan: "#f43f5e",
  Pendidikan: "#6366f1",
  Hiburan: "#ec4899",
  Lainnya: "#6b7280",
};

function stringToColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

export function getCategoryColor(
  category: string,
  overrides?: Record<string, string>,
): string {
  if (overrides?.[category]) return overrides[category];
  return CATEGORY_META[category] ?? stringToColor(category);
}

export function buildCategoryColorMap(
  categories: { name: string; color: string | null }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of categories) {
    map[cat.name] = cat.color ?? stringToColor(cat.name);
  }
  return map;
}
