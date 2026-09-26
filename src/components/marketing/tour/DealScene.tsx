import { useState, type FormEvent } from "react";
import { Building2, CalendarClock, Check, History, Mail, MessageSquareText, PhoneCall, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TOUR_STAGES,
  formatMoney,
  memberById,
  shortDate,
  stageById,
  stageIndex,
  type StageId,
  type TourDeal,
} from "./data";
import { typingSteps, useDemoScript } from "./hooks";
import { Avatar, Card, LiveStatus, PlanChip, SceneHeader, Segmented } from "./ui";

type ActivityType = "call" | "email" | "meeting" | "note";

interface ActivityItem {
  id: string;
  type: ActivityType;
  text: string;
  when: string;
  by: string;
}

const TYPE_META: Record<ActivityType, { label: string; icon: typeof PhoneCall }> = {
  call: { label: "Call", icon: PhoneCall },
  email: { label: "Email", icon: Mail },
  meeting: { label: "Meeting", icon: Users },
  note: { label: "Note", icon: MessageSquareText },
};

const INITIAL_ACTIVITY: ActivityItem[] = [
  { id: "a1", type: "meeting", text: "Walkthrough with Grace and the site leads. Pricing for 3 sites agreed in principle.", when: "Today", by: "JM" },
  { id: "a2", type: "email", text: "Sent the draft rollout timeline.", when: "2 days ago", by: "JM" },
  { id: "a3", type: "call", text: "Discovery call — current system can't share records between clinics.", when: "Last week", by: "SR" },
];

const HISTORY = [
  { text: "Stage changed Proposal → Negotiation", by: "Jonah Mills", when: "2 days ago" },
  { text: "Value changed $24,000 → $27,500", by: "Jonah Mills", when: "5 days ago" },
  { text: "Owner changed Sara Ruiz → Jonah Mills", by: "Amira Khan", when: "2 weeks ago" },
];

type Tab = "activity" | "history";

export function DealScene({
  deal,
  onMove,
  demo,
  animate,
}: {
  deal: TourDeal;
  onMove: (dealId: string, stage: StageId) => void;
  demo: boolean;
  animate: boolean;
}) {
  const [activity, setActivity] = useState(INITIAL_ACTIVITY);
  const [type, setType] = useState<ActivityType>("note");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>("activity");
  const [status, setStatus] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const log = (text: string, kind: ActivityType = type) => {
    const t = text.trim();
    if (!t) return;
    const item = { id: `a-${Date.now()}`, type: kind, text: t, when: "Just now", by: "AK" };
    setActivity((a) => [item, ...a]);
    setFreshId(item.id);
    setDraft("");
    setStatus(`${TYPE_META[kind].label} logged on “${deal.title}”.`);
  };

  const setStage = (stage: StageId) => {
    if (stage === deal.stage) return;
    onMove(deal.id, stage);
    setStatus(`Stage changed to ${stageById(stage).name}. The pipeline board updates too.`);
  };

  useDemoScript(demo, [
    [600, () => setType("email")],
    ...typingSteps("Sent the revised 3-site pricing.", setDraft, 500, 45),
    [700, () => log("Sent the revised 3-site pricing.", "email")],
    [1400, () => setTab("history")],
    [2000, () => setTab("activity")],
  ]);

  const owner = memberById(deal.ownerId);
  const current = stageIndex(deal.stage);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    log(draft);
  };

  return (
    <div className="flex h-full flex-col">
      <SceneHeader
        title={deal.title}
        subtitle={
          <>
            {deal.company} · <span className="tabular-nums">{formatMoney(deal.value)}</span>
          </>
        }
      >
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">{stageById(deal.stage).name}</span>
      </SceneHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Stage stepper */}
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">Stage — click to change</p>
          <ol className="flex gap-1">
            {TOUR_STAGES.map((s, i) => (
              <li key={s.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setStage(s.id)}
                  aria-current={s.id === deal.stage ? "step" : undefined}
                  className="group w-full text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      i <= current ? "bg-foreground" : "bg-secondary group-hover:bg-muted-foreground/30",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1 block truncate text-[11px]",
                      s.id === deal.stage ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_220px]">
          <div className="min-w-0 space-y-3">
            <Segmented<Tab>
              label="Deal sections"
              value={tab}
              onChange={setTab}
              options={[
                { value: "activity", label: "Activity" },
                { value: "history", label: "Change history" },
              ]}
            />

            {tab === "activity" ? (
              <>
                <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Activity type">
                    {(Object.keys(TYPE_META) as ActivityType[]).map((k) => {
                      const Icon = TYPE_META[k].icon;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={type === k}
                          onClick={() => setType(k)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            type === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {TYPE_META[k].label}
                        </button>
                      );
                    })}
                  </div>
                  <label htmlFor="tour-activity" className="sr-only">
                    Activity details
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="tour-activity"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Log a ${TYPE_META[type].label.toLowerCase()}…`}
                      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Log
                    </button>
                  </div>
                </form>

                <ol className="relative space-y-3 border-l border-border pl-4">
                  {activity.map((a) => {
                    const Icon = TYPE_META[a.type].icon;
                    return (
                      <li
                        key={a.id}
                        className={cn("relative", freshId === a.id && animate && "animate-in fade-in-0 slide-in-from-top-1 duration-300")}
                      >
                        <span className="absolute -left-[25px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-card">
                          <Icon className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <p className="text-xs leading-relaxed">{a.text}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {TYPE_META[a.type].label} · {a.when} · {a.by}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs font-medium">Every change to this deal, with who made it</p>
                  <PlanChip feature="audit_history" className="ml-auto" />
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {HISTORY.map((h) => (
                    <li key={h.text} className="px-3 py-2">
                      <p className="text-xs">{h.text}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {h.by} · {h.when}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <Card className="divide-y divide-border text-xs">
              {[
                ["Owner", <span key="o" className="flex items-center gap-1.5"><Avatar initials={owner.initials} className="h-5 w-5" />{owner.name}</span>],
                ["Close date", <span key="c" className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />{shortDate(deal.closeInDays)}</span>],
                ["Probability", <span key="p" className="tabular-nums">{stageById(deal.stage).probability}%</span>],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-muted-foreground">{k}</span>
                  {v}
                </div>
              ))}
            </Card>
            <Card className="p-3">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">People</p>
              {[
                { i: "GO", n: "Grace Okafor", t: "Operations director" },
                { i: "DP", n: "Dev Patel", t: "Procurement" },
              ].map((p) => (
                <div key={p.n} className="flex items-center gap-2 py-1">
                  <Avatar initials={p.i} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.n}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.t}</p>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-xs">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {deal.company}
              </div>
            </Card>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Check className="h-3 w-3" aria-hidden="true" /> Next task: Confirm site visit dates
            </div>
          </aside>
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 sm:px-5">
        <LiveStatus message={status ?? "Log an activity or click a stage to move the deal."} />
      </div>
    </div>
  );
}
