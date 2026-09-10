import type { Industry, IndustryGroup } from "@b2b/shared";

export type IndustryBucket = {
  key: string;
  name: string;
  description: string | null;
  items: Industry[];
};

export function groupIndustries(
  items: Industry[],
  groups: IndustryGroup[] = []
): IndustryBucket[] {
  const descriptions = new Map(groups.map((g) => [g.id, g.description]));
  const buckets: IndustryBucket[] = [];

  for (const item of items) {
    const groupId = item.group?.id ?? null;
    const key = groupId === null ? "none" : String(groupId);
    const last = buckets[buckets.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    buckets.push({
      key,
      name: item.group?.name ?? "Ohne Gruppe",
      description: groupId === null ? null : descriptions.get(groupId) ?? null,
      items: [item],
    });
  }

  return buckets;
}
