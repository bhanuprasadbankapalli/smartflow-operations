import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, TaskStatusBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { orderItemsOf } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/packing")({
  head: () => ({
    meta: [
      { title: "Packing Station — SmartFlow WMS" },
      { name: "description", content: "Verify picked lines, pack orders and flag packing discrepancies before quality control." },
      { property: "og:title", content: "Packing Station — SmartFlow WMS" },
      { property: "og:description", content: "Verify and pack picked orders before quality control." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "worker"]}>
      <PackingPage />
    </RoleGate>
  ),
});

function PackingPage() {
  const { state, startPacking, completePacking, reportPackingIssue } = useWms();
  const tasks = state.packingTasks.filter((t) => t.status !== "COMPLETED");

  return (
    <>
      <PageHeader title="Packing Station" subtitle="Confirm each picked line, then pack the order and hand it to quality control." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Awaiting packing" value={tasks.filter((t) => t.status === "PENDING").length} />
        <KpiCard label="Packing now" value={tasks.filter((t) => t.status === "IN_PROGRESS").length} tone="info" />
        <KpiCard label="Packed today" value={state.packingTasks.filter((t) => t.status === "COMPLETED").length} tone="success" />
        <KpiCard label="Discrepancies" value={tasks.filter((t) => t.status === "ISSUE").length} tone="danger" />
      </div>

      <SectionCard className="mt-4" title={`Packing queue (${tasks.length})`}>
        {tasks.length === 0 ? (
          <EmptyState title="Packing queue is clear" description="Orders arrive here once every line has been picked." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.map((t) => {
              const order = state.orders.find((o) => o.id === t.orderId);
              if (!order) return null;
              const items = orderItemsOf(state, order.id);
              return (
                <div key={t.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold">{order.reference}</p>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <TaskStatusBadge status={t.status} />
                      <PriorityBadge priority={order.priority} />
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {items.map((it) => (
                      <li key={it.id} className="flex justify-between text-sm">
                        <span>{state.products.find((p) => p.id === it.productId)?.name}</span>
                        <span className="tabular text-muted-foreground">
                          {it.pickedQty}/{it.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.status === "PENDING" ? (
                      <Button size="sm" onClick={() => startPacking(order.id)}>Start packing</Button>
                    ) : (
                      <Button size="sm" onClick={() => completePacking(order.id)}>Mark packed</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => reportPackingIssue(order.id)}>Report discrepancy</Button>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </>
  );
}
