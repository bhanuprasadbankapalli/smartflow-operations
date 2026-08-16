import { createFileRoute } from "@tanstack/react-router";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge, PriorityBadge, SeverityBadge } from "@/components/wms/badges";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import { fmtDateTime, money } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Control — SmartFlow WMS" },
      { name: "description", content: "Courier assignment and shipment tracking from dispatch through to delivery." },
      { property: "og:title", content: "Dispatch Control — SmartFlow WMS" },
      { property: "og:description", content: "Courier assignment and shipment tracking from dispatch through to delivery." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "dispatcher"]}>
      <DispatchPage />
    </RoleGate>
  ),
});

function DispatchPage() {
  const { state, dispatchOrder, advanceShipment } = useWms();
  const ready = state.orders.filter((o) => o.status === "READY_TO_DISPATCH");

  return (
    <>
      <PageHeader title="Dispatch Control" subtitle="Assign couriers to inspected orders and track shipments to delivery." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Ready to dispatch" value={ready.length} tone="warning" />
        <KpiCard label="In transit" value={state.shipments.filter((s) => s.status === "IN_TRANSIT").length} tone="info" />
        <KpiCard label="Out for delivery" value={state.shipments.filter((s) => s.status === "OUT_FOR_DELIVERY").length} tone="info" />
        <KpiCard label="Delivered" value={state.shipments.filter((s) => s.status === "DELIVERED").length} tone="success" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title={`Dispatch queue (${ready.length})`}>
          {ready.length === 0 ? (
            <EmptyState title="Dispatch queue empty" description="Orders appear here after passing quality control." />
          ) : (
            <div className="space-y-2">
              {ready.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{o.id}</p>
                    <p className="text-[11px] text-muted-foreground">{o.destination}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={o.priority} />
                    <Button size="sm" onClick={() => dispatchOrder(o.id, o.priority === "CRITICAL" ? "SwiftEx Priority" : "MetroFreight")}>
                      Dispatch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Active shipments">
          {state.shipments.length === 0 ? (
            <EmptyState title="No shipments yet" description="Dispatch an order to create a shipment." />
          ) : (
            <div className="space-y-2">
              {state.shipments.slice(0, 12).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{s.trackingNumber}</p>
                    <p className="text-[11px] text-muted-foreground">{s.courier} · {s.orderId} · ETA {fmtDateTime(s.eta)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={s.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT"} />
                    {s.status !== "DELIVERED" && (
                      <Button size="sm" variant="outline" onClick={() => advanceShipment(s.id)}>Advance</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
