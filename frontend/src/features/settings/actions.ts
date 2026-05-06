"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { ActionResult } from "@/types/api";

/**
 * Update tenant settings
 */
export async function updateTenantSettings(
  prevState: ActionResult<Record<string, unknown>> | null,
  formData: FormData,
): Promise<ActionResult<Record<string, unknown>>> {
  const jsonData = formData.get("data");
  if (!jsonData || typeof jsonData !== "string") {
    return {
      success: false,
      error: { code: "validation_error", message: "Missing settings data" },
    };
  }

  let updates: Record<string, unknown>;
  try {
    updates = JSON.parse(jsonData) as Record<string, unknown>;
  } catch {
    return {
      success: false,
      error: { code: "validation_error", message: "Invalid JSON data" },
    };
  }

  const response = await api.patch<Record<string, unknown>>("/api/tenant/settings", updates);

  if (!response.success) {
    return {
      success: false,
      error: response.error,
    };
  }

  revalidatePath("/dashboard/settings");
  return { success: true, data: response.data };
}
