import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Circle, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, Pill, PriorityBadge, SeverityBadge, TaskStatusBadge } from "@/components/wms/badges";
import { DataRow, EmptyState, PageHeader, SectionCard } from "@/components/wms/bits";
import { cn } from "@/lib/utils";
import { availableQty, fmtDateTime, money, orderTotals, relative } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import type { OrderStatus } from "@/lib/wms/types";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.orderId} — SmartFlow WMS` },
      {
        name: "description",
        content: `Fulfilment timeline, priority explanation, allocation decision and exception history for order ${params.orderId}.`,
      },
      { property: "og:title", content: `Order ${params.orderId} — SmartFlow WMS` },
      { property: "og:description", content: "Fulfilment timeline, priority reasoning and allocation decisions." },
    ],
  }),
  component: OrderDetail,
  notFoundComponent: () => (
    <EmptyState title="Order not found" description="This order is no longer in the fulfilment book." />
  ),
  errorComponent: ({ error }) => <div role="alert" className="panel p-6 text-sm">{error.message}</div>,
});

const TIMELINE: { stage: OrderStatus; label: string }[] = [
  { stage: "NEW", label: "Order created" },
  { stage: "PRIORITIZED", label: "Priority determined" },
  { stage: "ALLOCATED", label: "Inventory allocated" },
  { stage: "PICKING", label: "Picking" },
  { stage: "PACKING", label: "Packing" },
  { stage: "QUALITY_CHECK", label: "Quality check" },
  { stage: "READY_FOR_DISPATCH", label: "Dispatch" },
  { stage: "COMPLETED", label: "Completed" },
];

const ORDER_OF = (s: OrderStatus) => {
  const map: Partial<Record<OrderStatus, number>> = {
    NEW: 0,
    PRIORITIZED: 1,
    ALLOCATED: 2,
    BACKORDER: 2,
    PICKING: 3,
    PACKING: 4,
    QUALITY_CHECK: 5,
    READY_FOR_DISPATCH: 6,
    DISPATCHED: 6,
    COMPLETED: 7,
    EXCEPTION: 3,
    CANCELLED: 0,
  };
  return map[s] ?? 0;
};

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { state, escalateOrder, runSmartAllocation, role } = useWms();
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) throw notFound();

  const customer = state.customers.find((c) => c.id === order.customerId);
  const { items, quantity, value } = orderTotals(state, order.id);
  const stageIndex = ORDER_OF(order.status);
  const picks = state.pickingTasks.filter((t) => t.orderId === order.id);
  const packing = state.packingTasks.find((t) => t.orderId === order.id);
  const qc = state.qualityChecks.find((t) => t.orderId === order.id);
  const shipment = state.shipments.find((s) => s.orderId === order.id);
  const exceptions = state.exceptions.filter((e) => e.orderId === order.id);
  const activity = state.activity.filter((a) => a.message.includes(order.id));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/orders">
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
      </Button>

      <PageHeader
        title={`Order ${order.id}`}
        subtitle={`${customer?.name} · ${order.destination} · deadline ${fmtDateTime(order.deadline)} (${relative(order.deadline, state.clock)})`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} score={order.priorityScore} />
            {role === "manager" && (
              <>
                <Button variant="outline" size="sm" onClick={() => escalateOrder(order.id)}>
                  <TrendingUp className="size-4" /> Escalate priority
                </Button>
                <Button size="sm" onClick={() => runSmartAllocation([order.id])}>
                  <Sparkles className="size-4" /> Allocate stock
                </Button>
              </>
            )}
          </>
        }
      />

      <SectionCard title="Fulfilment timeline" description="Every stage the order has passed through">
        <ol className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {TIMELINE.map((t, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            const minutes = order.stageDurations[t.stage];
            return (
              <li key={t.stage} className="flex gap-2.5 md:flex-col md:gap-1.5">
                <div className="flex items-center gap-2 md:w-full">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                      done && "border-success bg-success text-success-foreground",
                      active && "border-info bg-info-soft text-info",
                      !done && !active && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : <Circle className="size-2 fill-current" />}
                  </span>
                  <span className="hidden h-0.5 flex-1 bg-border md:block" />
                </div>
                <div>
                  <p className={cn("text-xs font-semibold", active && "text-info", done && "text-foreground")}>{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {minutes ? `${minutes} min` : done ? "done" : active ? "in progress" : "pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {order.status === "EXCEPTION" && (
          <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            Order is parked in EXCEPTION — resolve the linked exception to return it to the flow.
          </p>
        )}
      </SectionCard>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard title="Order lines" description="Required, allocated, picked and packed quantities" className="xl:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Req</TableHead>
                  <TableHead className="text-right">Alloc</TableHead>
                  <TableHead className="text-right">Picked</TableHead>
                  <TableHead className="text-right">Backorder</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const p = state.products.find((x) => x.id === i.productId);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{p?.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p?.sku} · {money(p?.unitPrice ?? 0)}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Aisle {p?.location.aisle} · {p?.location.rack} · Shelf {p?.location.shelf}
                      </TableCell>
                      <TableCell className="tabular text-right">{i.quantity}</TableCell>
                      <TableCell className="tabular text-right">{i.allocated}</TableCell>
                      <TableCell className="tabular text-right">{i.picked}</TableCell>
                      <TableCell className="tabular text-right">
                        {i.backordered > 0 ? <Pill tone="warning">{i.backordered}</Pill> : "0"}
                      </TableCell>
                      <TableCell className="tabular text-right">{p ? availableQty(p) : 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard title="Why this priority?" description={`Score ${order.priorityScore} → ${order.priority}`}>
            <ul className="flex flex-col gap-1.5">
              {order.priorityReasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {r}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Order summary">
            <DataRow label="Customer" value={`${customer?.name}${customer?.vip ? " (VIP)" : ""}`} />
            <DataRow label="Created" value={fmtDateTime(order.createdAt)} />
            <DataRow label="Deadline" value={fmtDateTime(order.deadline)} />
            <DataRow label="Total quantity" value={quantity} />
            <DataRow label="Order value" value={money(value)} />
            <DataRow label="Assigned worker" value={state.users.find((u) => u.id === order.assignedWorkerId)?.name ?? "Unassigned"} />
            <DataRow label="Shipment" value={shipment ? `${shipment.courier} · ${shipment.trackingId}` : "Not created"} />
          </SectionCard>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard title="Allocation decision" description="Explanation produced by the allocation engine">
          <p className="text-sm">{order.allocationNote ?? "No allocation has run for this order yet."}</p>
        </SectionCard>

        <SectionCard title="Stage records" description="Picking, packing and quality artefacts">
          <div className="flex flex-col gap-2">
            {picks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="text-xs">
                  {state.products.find((p) => p.id === t.productId)?.name} × {t.quantity}
                </span>
                <TaskStatusBadge status={t.status} />
              </div>
            ))}
            {packing && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="text-xs">Packing · {packing.packaging} · {packing.weightKg} kg</span>
                <TaskStatusBadge status={packing.status} />
              </div>
            )}
            {qc && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                <span className="text-xs">Quality check · {qc.inspector ?? "pending inspector"}</span>
                <Pill tone={qc.result === "PASSED" ? "success" : qc.result === "FAILED" ? "danger" : "neutral"}>{qc.result}</Pill>
              </div>
            )}
            {!picks.length && !packing && !qc && (
              <EmptyState title="No stage records yet" description="Records appear once the order is allocated and picked." />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Exceptions & activity">
          {exceptions.length > 0 ? (
            <div className="mb-3 flex flex-col gap-2">
              {exceptions.map((e) => (
                <div key={e.id} className="rounded-md border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase">{e.type.replaceAll("_", " ")}</span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.decision}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">No exceptions raised for this order.</p>
          )}
          <ol className="flex flex-col gap-2">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="text-xs">
                <span className="font-medium">{a.message}</span>
                <span className="block text-[11px] text-muted-foreground">{a.actor} · {fmtDateTime(a.at)}</span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </>
  );
}
