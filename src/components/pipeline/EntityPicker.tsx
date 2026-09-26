import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface EntityPickerProps {
  id?: string;
  value: string | null | undefined;
  /** Label for the current value when it isn't among `options` (e.g. not in the current search results). */
  selectedLabel?: string | null;
  options: PickerOption[];
  loading?: boolean;
  search: string;
  onSearchChange: (term: string) => void;
  onChange: (value: string | null, option?: PickerOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Adds a "None" item that clears the value. */
  allowClear?: boolean;
  clearLabel?: string;
  /** Offers "Create “term”" when the search has text. Resolve with the created option to select it. */
  onCreate?: (term: string) => Promise<PickerOption | null | undefined>;
  createLabel?: (term: string) => string;
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
  "aria-label"?: string;
}

/** Searchable single-select combobox (server-side search is done by the caller via `onSearchChange`). */
export function EntityPicker({
  id,
  value,
  selectedLabel,
  options,
  loading,
  search,
  onSearchChange,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  allowClear = true,
  clearLabel = "None",
  onCreate,
  createLabel = (t) => `Create “${t}”`,
  disabled,
  className,
  invalid,
  "aria-label": ariaLabel,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const current = options.find((o) => o.value === value);
  const label = current?.label ?? (value ? selectedLabel || "Selected" : null);
  const term = search.trim();
  const exactMatch = options.some((o) => o.label.toLowerCase() === term.toLowerCase());

  const select = (v: string | null, option?: PickerOption) => {
    onChange(v, option);
    setOpen(false);
    onSearchChange("");
  };

  const handleCreate = async () => {
    if (!onCreate || !term) return;
    setCreating(true);
    try {
      const created = await onCreate(term);
      if (created) select(created.value, created);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onSearchChange(""); }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-md px-3 font-normal",
            !label && "text-muted-foreground",
            invalid && "border-destructive",
            className,
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={onSearchChange} />
          <CommandList>
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching…
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {allowClear && value && !term && (
                <CommandItem value="__clear__" onSelect={() => select(null)}>
                  <X className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                  {clearLabel}
                </CommandItem>
              )}
              {!loading &&
                options.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => select(o.value, o)}>
                    <Check className={cn("mr-2 h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} aria-hidden />
                    {o.icon}
                    <div className="min-w-0">
                      <p className="truncate">{o.label}</p>
                      {o.description && <p className="truncate text-xs text-muted-foreground">{o.description}</p>}
                    </div>
                  </CommandItem>
                ))}
              {onCreate && term && !exactMatch && !loading && (
                <CommandItem value="__create__" onSelect={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-2 h-4 w-4" aria-hidden />}
                  {createLabel(term)}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
