import type { DashboardItem } from "./types";

export const findDashboardItemById = (
  items: DashboardItem[],
  itemId: number | string | null,
) =>
  itemId === null
    ? null
    : items.find((item) => String(item.id) === String(itemId)) || null;
