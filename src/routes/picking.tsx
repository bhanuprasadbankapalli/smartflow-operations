import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, MapPin, PackageX, Play, Route as RouteIcon } from "lucide-react";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pill, PriorityBadge, TaskStatusBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtTime, optimizeRoute } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/picking")({
  head: () => ({
    meta: [
      { title: "Picking Operations — SmartFlow WMS" },
      {
        name: "description",
        content:
          "Worker-friendly picking console with optimised aisle routes, live task status and one-tap missing or damaged reporting.",
      },
      { property: "og:title", content: "Picking Operations — SmartFlow WMS" },
      { property: "og:description", content: "Optimised picking routes and live task control for warehouse workers." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "worker"]}>
      <PickingPage />
    </RoleGate>
  ),
});

function PickingPage() {
  const { state, startPicking, completePick, reportPickIssue } = useWms();
  const open = state.pickingTasks.filter((t) => ["ASSIGNED", "IN_PROGRESS"].includes(t.status));
  const optimized = optimizeRoute(open);

  return (
    <>
      <PageHeader
        title="Picking Operations"
        subtitle="Tasks are grouped into an optimised aisle route. Completing all lines of an order moves it to packing automatically."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Open tasks" value={open.length} />
        <KpiCard label="In progress" value={open.filter((t) => t.status === "IN_PROGRESS").length} tone="info" />
        <KpiCard label="Completed today" value={state.pickingTasks.filter((t) => t.status === "COMPLETED").length} tone="success" />
        <KpiCard
          label="Issues reported"
          value={state.pickingTasks.filter((t) => ["MISSING", "DAMAGED"].includes(t.status)).length}
          tone="danger"
        />
      </div>

      <SectionCard
        className="mt-4"
        title="Optimised picking route"
        description={`Aisle-grouped travel: ${optimized.distanceBefore} m → ${optimized.distanceAfter} m`}
        actions={
          <Pill tone="success">
            <RouteIcon className="size-3" /> {optimized.metersSaved} m / {optimized.minutesSaved} min saved
          </Pill>
        }
      >
        {open.length === 0 ? (
          <EmptyState title="No open picking tasks" description="New tasks appear as soon as orders are allocated." />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Route order: {optimized.tasks.map((t) => t.location.aisle).join(" → ")}
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {optimized.tasks.map((t, idx) => {
                const p = state.products.find((x) => x.id === t.productId)!;
                return (
                  <div key={t.id} className="panel p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Stop {idx + 1} · {t.orderId}
                        </p>
                        <p className="mt-0.5 text-base font-bold">
                          {p.name} × {t.quantity}
                        </p>
                      </div>
                      <TaskStatusBadge status={t.status} />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" /> Aisle {t.location.aisle} · Rack {t.location.rack} · Shelf {t.location.shelf}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <span className="text-[11px] text-muted-foreground">
                        {t.startedAt ? `Started ${fmtTime(t.startedAt)}` : "Not started"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.status === "ASSIGNED" ? (
                        <Button size="sm" onClick={() => startPicking(t.id)}>
                          <Play className="size-4" /> Start picking
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => completePick(t.id)}>
                          Mark picked
                        </Button>
                      )}
                      <IssueButton label="Report missing" onConfirm={() => reportPickIssue(t.id, "MISSING")} icon={PackageX} />
                      <IssueButton label="Report damaged" onConfirm={() => reportPickIssue(t.id, "DAMAGED")} icon={AlertTriangle} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}

function IssueButton({
  label,
  onConfirm,
  icon: Icon,
}: {
  label: string;
  onConfirm: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Icon className="size-4" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This raises an exception. The system analyses replacement stock and proposes a decision automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
