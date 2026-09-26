import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** `id: null` means "create a new company with this name" on save. */
export type CompanyChoice = { id: string | null; name: string } | null;

interface CompanyPickerProps {
  id?: string;
  value: CompanyChoice;
  onChange: (value: CompanyChoice) => void;
  /** Allow choosing a name that doesn't exist yet (created on save). */
  allowCreate?: boolean;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

/** Searchable company combobox (server-side search, scales past 1000 companies). */
export function CompanyPicker({ id, value, onChange, allowCreate = true, placeholder = "Select a company", className, ...rest }: CompanyPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const { data: companies, isFetching } = useCompanies(debounced, { limit: 20, enabled: open });

  const term = search.trim();
  const exact = companies?.some((c) => c.name.toLowerCase() === term.toLowerCase());

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={rest["aria-invalid"]}
            className="h-9 flex-1 justify-between px-3 text-sm font-normal"
          >
            <span className={cn("flex min-w-0 items-center gap-2 truncate", !value && "text-muted-foreground")}>
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{value ? (value.id ? value.name : `New: ${value.name}`) : placeholder}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search companies…" value={search} onValueChange={setSearch} />
            <CommandList>
              {isFetching && !companies?.length ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
                </div>
              ) : (
                <CommandEmpty>{term ? "No companies found." : "No companies yet."}</CommandEmpty>
              )}
              {!!companies?.length && (
                <CommandGroup>
                  {companies.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onChange({ id: c.id, name: c.name });
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value?.id === c.id ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="truncate">{c.name}</span>
                      {c.industry && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{c.industry}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {allowCreate && term && !exact && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${term}`}
                    onSelect={() => {
                      onChange({ id: null, name: term });
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden /> Create “{term}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onChange(null)} aria-label="Clear company">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
