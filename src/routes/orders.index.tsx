import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Gauge, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge, Pill, PriorityBadge } from "@/components/wms/badges";
import { EmptyState, PageHeader, SectionCard } from "@/components/wms/bits";
import { RoleGate } from "@/components/wms/app-shell";
import { fmtDateTime, isDelayed, money, orderTotals, relative } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import type { OrderStatus, Priority } from "@/lib/wms/types";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Order Management — SmartFlow WMS" },
      {
        name: "description",
        content:
          "Search, filter and prioritise every order in the fulfilment book with rule-based priority scores and delay tracking.",
      },
      { property: "og:title", content: "Order Management — SmartFlow WMS" },
      { property: "og:description", content: "Prioritised order book with allocation state and delay tracking." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "dispatcher"]}>
      <OrdersPage />
    </RoleGate>
  ),
});

const STATUSES: OrderStatus[] = [
  "NEW",
  "PRIORITIZED",
  "ALLOCATED",
  "PICKING",
  "PACKING",
  "QUALITY_CHECK",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "COMPLETED",
  "BACKORDER",
  "EXCEPTION",
];

const PAGE_SIZE = 10;

function OrdersPage() {
  const { state, runPrioritization, runSmartAllocation, role } = useWms();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const list = state.orders
      .map((o) => {
        const customer = state.customers.find((c) => c.id === o.customerId);
        const t = orderTotals(state, o.id);
        return { order: o, customer, ...t, delayed: isDelayed(o, state.clock) };
      })
      .filter((r) => (status === "ALL" ? true : r.order.status === status))
      .filter((r) => (priority === "ALL" ? true : r.order.priority === priority))
      .filter((r) =>
        q.trim()
          ? `${r.order.id} ${r.customer?.name ?? ""} ${r.order.destination}`.toLowerCase().includes(q.toLowerCase())
          : true,
      );
    const sorted = [...list].sort((a, b) => {
      if (sort === "priority") return b.order.priorityScore - a.order.priorityScore;
      if (sort === "deadline") return a.order.deadline - b.order.deadline;
      if (sort === "value") return b.value - a.value;
      return b.order.createdAt - a.order.createdAt;
    });
    return sorted;
  }, [state, q, status, priority, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Order Management"
        subtitle="Every order carries a rule-based priority score, allocation state and delay risk."
        actions={
          role === "manager" && (
            <>
              <Button variant="outline" size="sm" onClick={runPrioritization}>
                <Gauge className="size-4" /> Re-run prioritization
              </Button>
              <Button size="sm" onClick={() => runSmartAllocation()}>
                <Sparkles className="size-4" /> Run smart allocation
              </Button>
            </>
          )
        }
      />

      <SectionCard title={`Order book (${rows.length})`} description="Click any order to open its fulfilment timeline" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search order ID, customer or destination"
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-46"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
            <SelectTrigger className="w-38"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {(["CRITICAL", "HIGH", "MEDIUM", "NORMAL"] as Priority[]).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-42"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Sort: priority score</SelectItem>
              <SelectItem value="deadline">Sort: deadline</SelectItem>
              <SelectItem value="value">Sort: order value</SelectItem>
              <SelectItem value="created">Sort: newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No orders match your filters" description="Clear the search or pick a different status." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ order, customer, quantity, value, delayed }) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold">
                      {order.id}
                      <p className="text-[11px] font-normal text-muted-foreground">{fmtDateTime(order.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{customer?.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {order.destination} {customer?.vip && <Pill tone="accent" className="ml-1">VIP</Pill>}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {relative(order.deadline, state.clock)}
                      {delayed && <Pill tone="danger" className="ml-1">Delayed</Pill>}
                    </TableCell>
                    <TableCell><PriorityBadge priority={order.priority} score={order.priorityScore} /></TableCell>
                    <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                    <TableCell className="tabular text-right">{quantity}</TableCell>
                    <TableCell className="tabular text-right">{money(value)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {state.users.find((u) => u.id === order.assignedWorkerId)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/orders/$orderId" params={{ orderId: order.id }} aria-label={`Open ${order.id}`}>
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">
            Page {current} of {pages} · {rows.length} orders
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
