import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useContacts, Contact, useDeleteContact } from "@/hooks/useContacts";
import { CreateContactDialog } from "@/components/contacts/CreateContactDialog";
import { ContactDetailSheet } from "@/components/contacts/ContactDetailSheet";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PageBanner } from "@/components/PageBanner";
import { Search, Plus, Users, Mail, Phone, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDemoContacts } from "@/lib/demoData";

export default function Contacts() {
  const { isDemoMode } = useAuth();
  const [search, setSearch] = useState("");
  const { data: rawContacts, isLoading } = useContacts(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deleteContact = useDeleteContact();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const useFallback = isDemoMode;

  const contacts: Contact[] = useMemo(() => {
    if (useFallback) {
      const demo = getDemoContacts();
      const mapped = demo.map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        position: c.position,
        company_id: null,
        tags: c.tags,
        created_by: "demo-user",
        created_at: c.created_at,
        updated_at: c.created_at,
        companies: { id: "c1", name: c.company_name },
      }));

      if (!search) return mapped;
      const s = search.toLowerCase();
      return mapped.filter(
        (c) =>
          c.first_name.toLowerCase().includes(s) ||
          c.last_name.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.companies?.name?.toLowerCase().includes(s)
      );
    }
    return rawContacts || [];
  }, [useFallback, rawContacts, search]);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && contacts) {
      const found = contacts.find((c) => c.id === openId);
      if (found) {
        setSelectedContact(found);
        searchParams.delete("open");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, contacts, setSearchParams]);

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
    if (!contacts) return;
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    if (isDemoMode) {
      setSelected(new Set());
      setDeleting(false);
      toast({ title: `${selected.size} contacts deleted (Sandbox)` });
      return;
    }
    await Promise.all(Array.from(selected).map((id) => deleteContact.mutateAsync(id)));
    setSelected(new Set());
    setDeleting(false);
    toast({ title: `${selected.size} contacts deleted` });
  };

  return (
    <div className="space-y-6">
      <PageBanner title="Contacts & Leads" description="Enterprise stakeholders, decision makers, and key champions.">
        <div className="flex items-center gap-2">
          {useFallback && (
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta Contacts Active
            </Badge>
          )}
          <Button className="w-full sm:w-auto text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Contact
          </Button>
        </div>
      </PageBanner>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search contacts by name, email, or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs h-9" />
      </div>

      {!useFallback && isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !contacts?.length ? (
        <div className="flex flex-col items-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">No contacts found</h3>
          <p className="text-muted-foreground text-sm mb-4">Add your first contact to get started.</p>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add contact
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox checked={selected.size === contacts.length && contacts.length > 0} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs font-semibold">Name & Role</TableHead>
                <TableHead className="text-xs font-semibold">Company</TableHead>
                <TableHead className="text-xs font-semibold">Communication</TableHead>
                <TableHead className="text-xs font-semibold">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => setSelectedContact(contact)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="w-10">
                    <Checkbox checked={selected.has(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.position && (
                        <p className="text-[11px] text-muted-foreground">{contact.position}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-foreground">
                      {contact.companies?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1.5 hover:text-foreground">
                          <Mail className="h-3 w-3 text-muted-foreground/70" />
                          <span className="text-[11px]">{contact.email}</span>
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1.5 hover:text-foreground">
                          <Phone className="h-3 w-3 text-muted-foreground/70" />
                          <span className="text-[11px] font-mono">{contact.phone}</span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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

      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContactDetailSheet
        contact={selectedContact}
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      />
    </div>
  );
}
