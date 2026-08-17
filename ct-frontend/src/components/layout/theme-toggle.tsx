"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "menu-item";
}

export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "menu-item") return null;
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("size-9", className)}
        aria-label="Ubah tema"
        disabled
      >
        <Sun className="size-4" />
      </Button>
    );
  }

  if (variant === "menu-item") {
    return (
      <div className={cn("flex gap-1 px-1", className)}>
        <Button
          type="button"
          variant={theme === "light" ? "secondary" : "ghost"}
          size="icon"
          className="size-9"
          aria-label="Mode terang"
          onClick={() => setTheme("light")}
        >
          <Sun className="size-4" />
        </Button>
        <Button
          type="button"
          variant={theme === "dark" ? "secondary" : "ghost"}
          size="icon"
          className="size-9"
          aria-label="Mode gelap"
          onClick={() => setTheme("dark")}
        >
          <Moon className="size-4" />
        </Button>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-9", className)}
      aria-label={isDark ? "Ubah ke mode terang" : "Ubah ke mode gelap"}
      onClick={toggleTheme}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
