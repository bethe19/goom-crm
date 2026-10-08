import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { ilikeAny } from "@/lib/postgrest";
import { errorMessage } from "@/components/settings/validation";
import { useDealOptions } from "@/hooks/useDeals";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import { MemberAvatar } from "./MemberAvatar";
import { memberName, useWorkspaceMembers } from "./useWorkspaceMembers";

interface BasePickerProps {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null, option?: PickerOption) => void;
  /** Known label of the current value (avoids an extra lookup). */
  selectedLabel?: string | null;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowClear?: boolean;
  className?: string;
  "aria-label"?: string;
}

function useLabelLookup(table: "companies" | "contacts" | "deals", id: string | null | undefined, known: string | null | undefined) {
  return useQuery({
    queryKey: ["picker-label", table, id],
    queryFn: async (): Promise<string | null> => {
      const cols = table === "contacts" ? "first_name, last_name" : table === "deals" ? "title" : "name";
      const { data, error } = await supabase.from(table).select(cols).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as Record<string, string | null>;
      return table === "contacts" ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() : table === "deals" ? row.title : row.name;
    },
    enabled: !!id && !known,
    staleTime: 5 * 60_000,
  });
}

export function CompanyPicker({ allowCreate = true, ...props }: BasePickerProps & { allowCreate?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 250);
  const { data, isFetching } = useQuery({
    queryKey: ["company-options", term],
    queryFn: async (): Promise<PickerOption[]> => {
      let q = supabase.from("companies").select("id, name, industry").order("name").limit(20);
      const f = ilikeAny(["name"], term);
      if (f) q = q.or(f);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as { id: string; name: string; industry: string | null }[]).map((c) => ({
        value: c.id,
        label: c.name,
        description: c.industry ?? undefined,
      }));
    },
    staleTime: 30_000,
  });
  const label = useLabelLookup("companies", props.value, props.selectedLabel);

  return (
    <EntityPicker
      {...props}
      selectedLabel={props.selectedLabel ?? label.data}
      options={data ?? []}
      loading={isFetching && !data}
      search={search}
      onSearchChange={setSearch}
      placeholder={props.placeholder ?? "Select company"}
      searchPlaceholder="Search companies…"
      emptyText="No companies found."
      onCreate={
        allowCreate
          ? async (name) => {
              const { data: created, error } = await supabase
                .from("companies")
                .insert({ name, created_by: user?.id })
                .select("id, name")
                .single();
              if (error) {
                toast({ title: "Couldn't create company", description: errorMessage(error), variant: "destructive" });
                return null;
              }
              queryClient.invalidateQueries({ queryKey: ["companies"] });
              queryClient.invalidateQueries({ queryKey: ["company-options"] });
              queryClient.invalidateQueries({ queryKey: ["global-search"] });
              toast({ title: "Company created", description: created.name, variant: "success" });
              return { value: created.id, label: created.name };
            }
          : undefined
      }
      createLabel={(t) => `Create company “${t}”`}
    />
  );
}

export function ContactPicker({ allowCreate = true, companyId, ...props }: BasePickerProps & { allowCreate?: boolean; companyId?: string | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 250);
  const { data, isFetching } = useQuery({
    queryKey: ["contact-options", term],
    queryFn: async (): Promise<PickerOption[]> => {
      let q = supabase.from("contacts").select("id, first_name, last_name, email, companies(name)").order("first_name").limit(20);
      // Every word must match a column, so "Jane Smith" finds first_name=Jane, last_name=Smith.
      for (const word of term.trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
        const f = ilikeAny(["first_name", "last_name", "email"], word);
        if (f) q = q.or(f);
      }
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as { id: string; first_name: string; last_name: string; email: string | null; companies: { name: string } | null }[]).map((c) => ({
        value: c.id,
        label: `${c.first_name} ${c.last_name}`.trim(),
        description: [c.companies?.name, c.email].filter(Boolean).join(" · ") || undefined,
      }));
    },
    staleTime: 30_000,
  });
  const label = useLabelLookup("contacts", props.value, props.selectedLabel);

  return (
    <EntityPicker
      {...props}
      selectedLabel={props.selectedLabel ?? label.data}
      options={data ?? []}
      loading={isFetching && !data}
      search={search}
      onSearchChange={setSearch}
      placeholder={props.placeholder ?? "Select contact"}
      searchPlaceholder="Search contacts…"
      emptyText="No contacts found."
      onCreate={
        allowCreate
          ? async (fullName) => {
              const [first, ...rest] = fullName.split(/\s+/);
              const { data: created, error } = await supabase
                .from("contacts")
                .insert({ first_name: first, last_name: rest.join(" "), company_id: companyId || null, created_by: user?.id })
                .select("id, first_name, last_name")
                .single();
              if (error) {
                toast({ title: "Couldn't create contact", description: errorMessage(error), variant: "destructive" });
                return null;
              }
              queryClient.invalidateQueries({ queryKey: ["contacts"] });
              queryClient.invalidateQueries({ queryKey: ["contact-options"] });
              queryClient.invalidateQueries({ queryKey: ["global-search"] });
              queryClient.invalidateQueries({ queryKey: ["workspace-usage"] });
              const name = `${created.first_name} ${created.last_name}`.trim();
              toast({ title: "Contact created", description: name, variant: "success" });
              return { value: created.id, label: name };
            }
          : undefined
      }
      createLabel={(t) => `Create contact “${t}”`}
    />
  );
}

export function DealPicker(props: BasePickerProps) {
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 250);
  const { data, isFetching } = useDealOptions(term);
  const label = useLabelLookup("deals", props.value, props.selectedLabel);
  const options = useMemo(() => (data ?? []).map((d) => ({ value: d.id, label: d.title })), [data]);
  return (
    <EntityPicker
      {...props}
      selectedLabel={props.selectedLabel ?? label.data}
      options={options}
      loading={isFetching && !data}
      search={search}
      onSearchChange={setSearch}
      placeholder={props.placeholder ?? "Select deal"}
      searchPlaceholder="Search deals…"
      emptyText="No deals found."
    />
  );
}

export function MemberPicker({ unassignedLabel = "Unassigned", ...props }: BasePickerProps & { unassignedLabel?: string }) {
  const { user } = useAuth();
  const { members, byId, isLoading } = useWorkspaceMembers();
  const [search, setSearch] = useState("");
  const options = useMemo(() => {
    const t = search.trim().toLowerCase();
    return members
      .filter((m) => !t || memberName(m).toLowerCase().includes(t) || (m.email ?? "").toLowerCase().includes(t))
      .map((m) => ({
        value: m.user_id,
        label: m.user_id === user?.id ? `${memberName(m)} (you)` : memberName(m),
        description: m.job_title || m.email || undefined,
        icon: <MemberAvatar member={m} tooltip={false} className="mr-2 h-5 w-5" />,
      }));
  }, [members, search, user?.id]);
  const current = props.value ? byId.get(props.value) : undefined;
  return (
    <EntityPicker
      {...props}
      selectedLabel={props.selectedLabel ?? (current ? memberName(current) : props.value === user?.id ? "You" : null)}
      options={options}
      loading={isLoading}
      search={search}
      onSearchChange={setSearch}
      placeholder={props.placeholder ?? unassignedLabel}
      searchPlaceholder="Search people…"
      emptyText="No teammates found."
      clearLabel={unassignedLabel}
    />
  );
}
