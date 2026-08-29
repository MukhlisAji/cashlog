"use client";

import { useEffect, useState } from "react";

import { isDemoMode } from "@/lib/demo";
import { adminService } from "@/services/admin.service";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isDemoMode()) return;
    void adminService.getOverview().then((result) => {
      setIsAdmin(result.success);
    });
  }, []);

  return isAdmin;
}
