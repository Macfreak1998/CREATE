import type { Technology, TechnologyGroup } from "@b2b/shared";

export type TechnologyBucket = {
  key: string;
  name: string;
  description: string | null;
  items: Technology[];
};

// Die API liefert Technologien bereits in Gruppen- und Sortierreihenfolge,
// hier werden sie nur noch in Bloecke geschnitten. Die Beschreibung stammt
// aus der Gruppen-Taxonomie und wird als Hinweis am Gruppentitel angezeigt.
export function groupTechnologies(
  items: Technology[],
  groups: TechnologyGroup[] = []
): TechnologyBucket[] {
  const descriptions = new Map(groups.map((g) => [g.id, g.description]));
  const buckets: TechnologyBucket[] = [];

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
