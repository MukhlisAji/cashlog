export const DEFAULT_CATEGORIES = [
  {
    name: "Makanan",
    keywords: "kopi,makan,warung,resto,grab food,gofood",
    color: "#22c55e",
    sort_order: 1,
  },
  {
    name: "Transport",
    keywords: "grab,gojek,bensin,tol,parkir,taxi",
    color: "#3b82f6",
    sort_order: 2,
  },
  {
    name: "Utilitas",
    keywords: "listrik,pln,pdam,internet,wifi,pulsa",
    color: "#f59e0b",
    sort_order: 3,
  },
  {
    name: "Belanja",
    keywords: "alfamart,indomaret,supermarket,belanja",
    color: "#8b5cf6",
    sort_order: 4,
  },
  {
    name: "Kesehatan",
    keywords: "apotek,dokter,obat,rumah sakit,rs",
    color: "#ef4444",
    sort_order: 5,
  },
  {
    name: "Lainnya",
    keywords: "",
    color: "#6b7280",
    sort_order: 99,
  },
] as const;

export const TRANSACTION_HEADERS = [
  "tanggal",
  "item",
  "nominal",
  "kategori",
  "sumber",
  "catatan",
  "waktu",
  "pencatat",
] as const;

export const SHEET_TITLE = "cashlog.id - Keuangan Rumah Tangga";
