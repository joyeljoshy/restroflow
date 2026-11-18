import type { ModifierGroup } from "@restroflow/contracts";

export function ModifierSelector({
  groups,
  selectedIds,
  onChange,
  disabled = false,
}: {
  groups: ModifierGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">Modifier groups</legend>
      {groups.filter((group) => group.isActive).length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Create a modifier group to add choices to this item.
        </p>
      ) : (
        groups
          .filter((group) => group.isActive)
          .map((group) => (
            <label
              key={group.id}
              className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-3"
            >
              <input
                type="checkbox"
                className="mt-1 size-4 accent-emerald-700"
                checked={selectedIds.includes(group.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selectedIds, group.id]
                      : selectedIds.filter((id) => id !== group.id),
                  )
                }
              />
              <span>
                <span className="block text-sm font-semibold">
                  {group.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {group.isRequired ? "Required" : "Optional"} · choose{" "}
                  {group.minSelections}–{group.maxSelections}
                </span>
              </span>
            </label>
          ))
      )}
    </fieldset>
  );
}
