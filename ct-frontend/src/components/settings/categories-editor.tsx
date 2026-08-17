"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, Plus, Trash2 } from "lucide-react";

import { UpgradeProButton } from "@/components/subscription/upgrade-pro-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscription } from "@/hooks/use-subscription";
import {
  categoriesService,
  type Category,
} from "@/services/subscription.service";

interface CategoriesEditorProps {
  onChange?: () => void;
}

export function CategoriesEditor({ onChange }: CategoriesEditorProps) {
  const { canManageCategories } = useSubscription();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await categoriesService.list();
    if (result.success && result.data) {
      setCategories(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveKeywords(cat: Category, keywords: string) {
    setSavingId(cat.id);
    const result = await categoriesService.update(cat.id, { keywords });
    if (result.success && result.data) {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? result.data! : c)),
      );
    }
    setSavingId(null);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;

    setIsAdding(true);
    setError(null);
    const result = await categoriesService.create(name);
    if (result.success && result.data) {
      setCategories((prev) => [...prev, result.data!]);
      setNewName("");
      onChange?.();
    } else {
      setError(result.error ?? "Gagal menambah kategori");
    }
    setIsAdding(false);
  }

  async function handleRemove(cat: Category) {
    setError(null);
    const result = await categoriesService.remove(cat.id);
    if (result.success) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      onChange?.();
    } else {
      setError(result.error ?? "Gagal menghapus kategori");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Memuat kategori...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Hubungkan Google Sheet terlebih dahulu untuk mengaktifkan kategori.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {canManageCategories
          ? "Kelola kategori sesuai kebutuhan keluarga. Kategori yang dihapus tidak muncul di budget & chart bulan ini."
          : "Langganan tidak aktif. Aktifkan langganan untuk mengelola kategori."}
      </p>

      {!canManageCategories && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            <Crown className="size-4 text-amber-600" />
            Kategori custom — perlu langganan aktif
          </p>
          <UpgradeProButton variant="outline" label="Aktifkan langganan" />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {categories.map((cat) => (
        <div
          key={cat.id}
          className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`cat-${cat.id}`} className="flex items-center gap-2">
              {cat.color && (
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              {cat.name}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              disabled={!canManageCategories || categories.length <= 1}
              onClick={() => void handleRemove(cat)}
              aria-label={`Hapus ${cat.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              id={`cat-${cat.id}`}
              defaultValue={cat.keywords ?? ""}
              placeholder="kopi, makan, warung"
              onBlur={(e) => {
                if (e.target.value !== (cat.keywords ?? "")) {
                  void handleSaveKeywords(cat, e.target.value);
                }
              }}
            />
            {savingId === cat.id && (
              <Loader2 className="size-4 shrink-0 animate-spin self-center" />
            )}
          </div>
        </div>
      ))}

      {canManageCategories && (
        <div className="flex gap-2">
          <Input
            placeholder="Nama kategori baru, mis. Tabungan"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!newName.trim() || isAdding}
            onClick={() => void handleAdd()}
          >
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Tambah
          </Button>
        </div>
      )}
    </div>
  );
}
