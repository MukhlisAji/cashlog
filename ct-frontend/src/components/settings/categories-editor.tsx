"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, Plus, X } from "lucide-react";

import { SettingsSaveButton } from "@/components/settings/settings-save-button";
import { UpgradeProButton } from "@/components/subscription/upgrade-pro-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/toaster";
import { useSubscription } from "@/hooks/use-subscription";
import { NOTICE_MESSAGES } from "@/lib/notice";
import {
  categoriesService,
  type Category,
} from "@/services/subscription.service";

interface CategoriesEditorProps {
  onChange?: () => void;
}

export function CategoriesEditor({ onChange }: CategoriesEditorProps) {
  const { canManageCategories } = useSubscription();
  const [saved, setSaved] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [nextTempId, setNextTempId] = useState(-1);

  const load = useCallback(async () => {
    const result = await categoriesService.list();
    if (result.success && result.data) {
      setSaved(result.data);
      setDraft(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const savedIds = saved.map((c) => c.id).sort().join(",");
    const draftIds = draft.map((c) => c.id).sort().join(",");
    if (savedIds !== draftIds) return true;
    return draft.some((c) => {
      if (c.id < 0) return true;
      const original = saved.find((s) => s.id === c.id);
      return original?.name !== c.name;
    });
  }, [draft, saved]);

  function addChip() {
    const name = newName.trim();
    if (!name) return;
    const exists = draft.some(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      showToast("error", "Kategori itu sudah ada.");
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        id: nextTempId,
        user_id: "",
        name,
        keywords: name.toLowerCase(),
        color: null,
        sort_order: prev.length,
      },
    ]);
    setNextTempId((id) => id - 1);
    setNewName("");
  }

  function resetDraft() {
    setDraft(saved);
    setNewName("");
  }

  function removeChip(cat: Category) {
    if (draft.length <= 1) {
      showToast("error", "Minimal satu kategori harus tersisa.");
      return;
    }
    setDraft((prev) => prev.filter((c) => c.id !== cat.id));
  }

  async function handleSave() {
    if (!canManageCategories) return;
    setIsSaving(true);

    const draftPersisted = draft.filter((c) => c.id > 0);
    const draftPersistedIds = new Set(draftPersisted.map((c) => c.id));
    const toDelete = saved.filter((c) => !draftPersistedIds.has(c.id));
    const toCreate = draft.filter((c) => c.id < 0);

    let failed = false;
    let failMessage = NOTICE_MESSAGES.save_failed.text;
    for (const cat of toDelete) {
      const result = await categoriesService.remove(cat.id);
      if (!result.success) {
        failed = true;
        failMessage = result.error ?? failMessage;
        break;
      }
    }
    if (!failed) {
      for (const cat of toCreate) {
        const result = await categoriesService.create(cat.name, cat.keywords ?? undefined);
        if (!result.success) {
          failed = true;
          failMessage = result.error ?? failMessage;
          break;
        }
      }
    }

    if (failed) {
      showToast(NOTICE_MESSAGES.save_failed.kind, failMessage);
      setIsSaving(false);
      return;
    }

    await load();
    onChange?.();
    showToast(NOTICE_MESSAGES.saved.kind, NOTICE_MESSAGES.saved.text);
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Memuat kategori...
      </div>
    );
  }

  if (saved.length === 0 && draft.length === 0) {
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
          ? "Tambah atau hapus kategori. Perubahan diterapkan setelah kamu simpan."
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

      <div className="flex flex-wrap items-center gap-2">
        {draft.map((cat) => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm"
          >
            {cat.color ? (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            ) : null}
            {cat.name}
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              disabled={!canManageCategories || draft.length <= 1}
              onClick={() => removeChip(cat)}
              aria-label={`Hapus ${cat.name}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {canManageCategories ? (
          <div className="inline-flex h-8 min-w-[10rem] flex-1 items-center gap-1 rounded-full border border-dashed bg-background px-2 sm:flex-none">
            <Input
              className="h-7 min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
              placeholder="Tambah kategori"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChip();
                }
              }}
            />
            <button
              type="button"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              disabled={!newName.trim()}
              onClick={addChip}
              aria-label="Tambah kategori"
            >
              <Plus className="size-4" />
            </button>
          </div>
        ) : null}
      </div>

      {canManageCategories ? (
        <div className="flex flex-col gap-2">
          {dirty ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              disabled={isSaving}
              onClick={resetDraft}
            >
              Reset
            </Button>
          ) : null}
          <SettingsSaveButton
            onClick={() => void handleSave()}
            loading={isSaving}
            disabled={!dirty}
            label="Simpan"
          />
        </div>
      ) : null}
    </div>
  );
}
