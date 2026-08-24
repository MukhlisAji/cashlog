"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { SettingsSaveButton } from "@/components/settings/settings-save-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showToast } from "@/components/ui/toaster";
import { formatMonthLabel, formatRupiah } from "@/lib/format";
import { NOTICE_MESSAGES } from "@/lib/notice";
import {
  categoriesService,
  type Category,
} from "@/services/subscription.service";
import {
  budgetsService,
  type BudgetItem,
} from "@/services/budgets.service";

function parseAmount(value: string): number {
  const n = Number(value.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatAmountInput(amount: number): string {
  if (amount <= 0) return "";
  return new Intl.NumberFormat("id-ID").format(amount);
}

export function BudgetsEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savedAmounts, setSavedAmounts] = useState<Record<string, string>>({});
  const [month, setMonth] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [catResult, budgetResult] = await Promise.all([
      categoriesService.list(),
      budgetsService.list(),
    ]);

    if (catResult.success && catResult.data) {
      setCategories(catResult.data);
    }

    if (budgetResult.success && budgetResult.data) {
      setMonth(budgetResult.data.month);
      const map: Record<string, string> = {};
      for (const b of budgetResult.data.budgets) {
        map[b.category] = formatAmountInput(b.amount);
      }
      setAmounts(map);
      setSavedAmounts(map);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalBudget = useMemo(
    () =>
      Object.values(amounts).reduce((s, v) => s + parseAmount(v), 0),
    [amounts],
  );

  const dirty = useMemo(() => {
    const keys = new Set([
      ...Object.keys(savedAmounts),
      ...Object.keys(amounts),
      ...categories.map((c) => c.name),
    ]);
    for (const key of keys) {
      if (parseAmount(amounts[key] ?? "") !== parseAmount(savedAmounts[key] ?? "")) {
        return true;
      }
    }
    return false;
  }, [amounts, savedAmounts, categories]);

  async function handleSave() {
    setIsSaving(true);

    const budgets: BudgetItem[] = categories.map((cat) => ({
      category: cat.name,
      amount: parseAmount(amounts[cat.name] ?? ""),
    }));

    const result = await budgetsService.save(budgets, month || undefined);

    if (result.success) {
      const map: Record<string, string> = {};
      if (result.data?.budgets) {
        for (const b of result.data.budgets) {
          map[b.category] = formatAmountInput(b.amount);
        }
      } else {
        for (const [key, value] of Object.entries(amounts)) {
          map[key] = value;
        }
      }
      setAmounts(map);
      setSavedAmounts(map);
      showToast(NOTICE_MESSAGES.saved.kind, NOTICE_MESSAGES.saved.text);
    } else {
      showToast(
        NOTICE_MESSAGES.save_failed.kind,
        NOTICE_MESSAGES.save_failed.text,
      );
    }

    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Memuat budget...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Hubungkan Google Sheet terlebih dahulu untuk mengatur budget per kategori.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Budget bulanan per kategori
          {month ? ` · ${formatMonthLabel(month)}` : ""}
        </p>
        <p className="text-sm font-semibold">
          Total: {formatRupiah(totalBudget)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3"
          >
            <Label htmlFor={`budget-${cat.id}`} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: cat.color ?? "#6366f1" }}
              />
              {cat.name}
            </Label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">
                Rp
              </span>
              <Input
                id={`budget-${cat.id}`}
                type="text"
                inputMode="numeric"
                className="pl-9"
                placeholder="0"
                value={amounts[cat.name] ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setAmounts((prev) => ({
                    ...prev,
                    [cat.name]: raw
                      ? new Intl.NumberFormat("id-ID").format(Number(raw))
                      : "",
                  }));
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            disabled={isSaving}
            onClick={() => setAmounts(savedAmounts)}
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
    </div>
  );
}
