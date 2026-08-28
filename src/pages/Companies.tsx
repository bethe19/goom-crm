import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompanies, Company, useDeleteCompany } from "@/hooks/useCompanies";
import { useContacts } from "@/hooks/useContacts";
import { CreateCompanyDialog } from "@/components/companies/CreateCompanyDialog";
import { CompanyDetailSheet } from "@/components/companies/CompanyDetailSheet";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageBanner } from "@/components/PageBanner";
import { Search, Building2, Globe, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDemoCompanies } from "@/lib/demoData";
import { sanitizeHref } from "@/lib/sanitize";

export default function Companies() {
  const { isDemoMode } = useAuth();
  const { data: rawCompanies, isLoading } = useCompanies();
  const { data: contacts } = useContacts();
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deleteCompany = useDeleteCompany();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const useFallback = isDemoMode;

  const companies: Company[] = useMemo(() => {
    if (useFallback) {
      const demo = getDemoCompanies();
      return demo.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        website: c.website,
        created_by: "demo-user",
        created_at: c.created_at,
        updated_at: c.created_at,
      }));
    }
    return rawCompanies || [];
  }, [useFallback, rawCompanies]);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && companies) {
      const found = companies.find((c) => c.id === openId);
      if (found) {
        setSelectedCompany(found);
        searchParams.delete("open");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, companies, setSearchParams]);

  const filtered = useMemo(() => {
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.industry?.toLowerCase().includes(search.toLowerCase())
    );
  }, [companies, search]);

  const contactCount = (companyId: string) =>
    contacts?.filter((c) => c.company_id === companyId).length ?? 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    if (isDemoMode) {
      setSelected(new Set());
      setDeleting(false);
      toast({ title: `${selected.size} companies deleted (Sandbox)` });
      return;
    }
    const count = selected.size;
    await Promise.all(Array.from(selected).map((id) => deleteCompany.mutateAsync(id)));
    setSelected(new Set());
    setDeleting(false);
    toast({ title: `${count} companies deleted` });
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Companies & Accounts" description="Track key accounts, enterprise logos, and industry segments.">
        <div className="flex items-center gap-2">
          {useFallback && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta Accounts Active
            </Badge>
          )}
          <CreateCompanyDialog />
        </div>
      </PageBanner>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs h-9" />
      </div>

      {!useFallback && isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs font-semibold">Company Name</TableHead>
                <TableHead className="text-xs font-semibold">Industry</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-semibold">Website</TableHead>
                <TableHead className="text-right text-xs font-semibold">Contacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium">No companies found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((company) => (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => setSelectedCompany(company)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} className="w-10">
                      <Checkbox checked={selected.has(company.id)} onCheckedChange={() => toggleSelect(company.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background font-semibold text-xs shrink-0">
                          {company.name.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          {company.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        {company.industry || "General Enterprise"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {company.website ? (
                        <a
                          href={sanitizeHref(company.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        >
                          <Globe className="h-3 w-3" />
                          <span>{company.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground font-mono">
                      {contactCount(company.id)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={handleBulkDelete}
        deleting={deleting}
      />

      <CompanyDetailSheet
        company={selectedCompany}
        open={!!selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
      />
    </div>
  );
}
