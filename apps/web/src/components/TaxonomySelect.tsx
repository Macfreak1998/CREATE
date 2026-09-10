import type { Taxonomy } from "@b2b/shared";

export default function TaxonomySelect({
  items,
  selected,
  onChange,
  emptyText = "Keine Einträge verfügbar.",
}: {
  items: Taxonomy[];
  selected: number[];
  onChange: (ids: number[]) => void;
  emptyText?: string;
}) {
  const sel = new Set(selected);
  const toggle = (id: number) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-start gap-2 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            checked={sel.has(item.id)}
            onChange={() => toggle(item.id)}
            className="checkbox mt-0.5"
          />
          <span>{item.name}</span>
        </label>
      ))}
    </div>
  );
}
