import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  matchesQuery,
  memberById,
  nextStage,
  relativeDays,
  stageById,
  stageTotals,
  weightedPipeline,
  type StageId,
  type TourDeal,
} from "./data";
import { useDemoScript } from "./hooks";
import { Avatar, LiveStatus, SceneHeader } from "./ui";

interface PipelineSceneProps {
  deals: TourDeal[];
  onMove: (dealId: string, stage: StageId) => void;
  onAdd: (deal: TourDeal) => void;
  demo: boolean;
  animate: boolean;
}

export function PipelineScene({ deals, onMove, onAdd, demo, animate }: PipelineSceneProps) {
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [movedId, setMovedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<StageId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newValue, setNewValue] = useState("");

  const move = (dealId: string, stage: StageId) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    onMove(dealId, stage);
    setMovedId(dealId);
    setStatus(`Moved “${deal.title}” to ${stageById(stage).name}.`);
  };

  useDemoScript(demo, [
    [1200, () => setFocusId("d5")],
    [1300, () => move("d5", "negotiation")],
    [1600, () => setFocusId("d4")],
    [1100, () => move("d4", "proposal")],
    [1500, () => setFocusId(null)],
  ]);

  const visible = useMemo(() => deals.filter((d) => matchesQuery(query, d.title, d.company, d.contact)), [deals, query]);
  const totals = stageTotals(visible);
  const weighted = weightedPipeline(deals);

  const onDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (e: DragEvent, stage: StageId) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id) move(id, stage);
  };

  const submitNew = (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const value = Math.max(0, Number(newValue.replace(/[^0-9.]/g, "")) || 0);
    const deal: TourDeal = {
      id: `new-${Date.now()}`,
      title,
      company: "New company",
      contact: "—",
      value,
      stage: "lead",
      ownerId: "u1",
      closeInDays: 30,
      lastActivityDays: 0,
    };
    onAdd(deal);
    setMovedId(deal.id);
    setStatus(`Added “${title}” to Lead.`);
    setNewTitle("");
    setNewValue("");
    setAdding(false);
  };

  return (
    <div className="flex h-full flex-col">
      <SceneHeader
        title="Sales pipeline"
        subtitle={
          <>
            {deals.filter((d) => d.stage !== "won").length} open deals · weighted{" "}
            <span className="tabular-nums">{formatMoney(weighted)}</span>
          </>
        }
      >
        <label className="relative hidden sm:block">
          <span className="sr-only">Search deals</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals"
            className="h-8 w-40 rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New deal
        </button>
      </SceneHeader>

      {adding && (
        <form onSubmit={submitNew} className="flex flex-wrap items-end gap-2 border-b border-border bg-secondary/40 px-4 py-3 sm:px-5">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Deal name
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Office move"
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            Value ($)
            <input
              inputMode="numeric"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="5000"
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            aria-label="Cancel new deal"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-4">
        <div className="flex h-full min-w-max gap-2.5 lg:grid lg:min-w-0 lg:grid-cols-5">
          {totals.map(({ stage, count, value }) => {
            const columnDeals = visible.filter((d) => d.stage === stage.id);
            return (
              <section
                key={stage.id}
                aria-label={`${stage.name} stage`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
                onDrop={(e) => onDrop(e, stage.id)}
                className={cn(
                  "flex w-[172px] shrink-0 flex-col rounded-lg bg-secondary/50 p-1.5 transition-colors duration-150 lg:w-auto",
                  dragOver === stage.id && "bg-secondary ring-1 ring-foreground/20",
                )}
              >
                <header className="px-1.5 pb-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn("h-2 w-2 rounded-full", stage.dot)} aria-hidden="true" />
                    {stage.name}
                    <span className="ml-auto tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{formatMoney(value)}</p>
                </header>
                <ul className="flex-1 space-y-1.5">
                  {columnDeals.map((deal) => {
                    const owner = memberById(deal.ownerId);
                    const next = nextStage(deal.stage);
                    const overdue = deal.closeInDays < 0 && deal.stage !== "won";
                    return (
                      <li
                        key={deal.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, deal.id)}
                        className={cn(
                          "group cursor-grab rounded-md border border-border bg-card p-2.5 shadow-xs transition-shadow duration-150 hover:shadow-sm active:cursor-grabbing",
                          focusId === deal.id && "ring-2 ring-foreground/70",
                          movedId === deal.id && animate && "animate-in fade-in-0 slide-in-from-left-3 duration-300",
                        )}
                      >
                        <p className="truncate text-xs font-medium">{deal.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{deal.company}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-xs font-semibold tabular-nums">{formatMoney(deal.value)}</span>
                          <span
                            className={cn(
                              "ml-auto truncate text-[11px]",
                              overdue ? "font-medium text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {deal.stage === "won" ? "Closed" : overdue ? "Overdue" : relativeDays(deal.closeInDays)}
                          </span>
                          <Avatar initials={owner.initials} title={owner.name} className="h-5 w-5" />
                        </div>
                        {next && (
                          <button
                            type="button"
                            onClick={() => move(deal.id, next)}
                            aria-label={`Move ${deal.title} to ${stageById(next).name}`}
                            className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:opacity-0 lg:group-hover:opacity-100"
                          >
                            Move to {stageById(next).name} <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {columnDeals.length === 0 && (
                    <li className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
                      {query ? "No matches" : "Drop a deal here"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 sm:px-5">
        <LiveStatus message={status ?? "Drag a card to another stage, or use “Move to…”."} />
      </div>
    </div>
  );
}

