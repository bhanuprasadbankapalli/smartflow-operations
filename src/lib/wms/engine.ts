import type {
  InventoryStatus,
  Order,
  OrderItem,
  OrderStatus,
  PickingTask,
  Priority,
  Product,
  Severity,
  WmsState,
} from "./types";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Fixed reference clock keeps the demo deterministic across SSR and client. */
export const BASE_TIME = new Date("2026-08-16T09:00:00.000Z").getTime();

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const fmtDateTime = (t: number) => `${fmtDate(t)}, ${fmtTime(t)}`;

export function relative(t: number, now: number) {
  const diff = t - now;
  const abs = Math.abs(diff);
  const unit = abs < HOUR ? `${Math.round(abs / 60000)}m` : abs < DAY ? `${Math.round(abs / HOUR)}h` : `${Math.round(abs / DAY)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}

/* ------------------------------- inventory ------------------------------- */

export const availableQty = (p: Product) => Math.max(0, p.quantity - p.reserved - p.damaged);

/** Reorder Point = (Average Daily Demand x Lead Time) + Safety Stock */
export const reorderPoint = (p: Product, leadTimeDays: number) =>
  Math.round(p.avgDailyDemand * leadTimeDays + p.safetyStock);

export const recommendedReorderQty = (p: Product) => Math.max(0, p.maxStock - availableQty(p));

export function inventoryStatus(p: Product, leadTimeDays: number): InventoryStatus {
  const avail = availableQty(p);
  if (avail === 0) return "OUT_OF_STOCK";
  if (avail <= reorderPoint(p, leadTimeDays)) return "LOW_STOCK";
  if (p.damaged > 0) return "DAMAGED";
  if (p.reserved > 0 && p.reserved >= p.quantity * 0.5) return "RESERVED";
  return "IN_STOCK";
}

export function leadTimeFor(state: WmsState, p: Product) {
  return state.suppliers.find((s) => s.id === p.supplierId)?.leadTimeDays ?? 3;
}

export function productStatus(state: WmsState, p: Product) {
  return inventoryStatus(p, leadTimeFor(state, p));
}

/* ------------------------------ prioritization ----------------------------- */

export interface PriorityResult {
  score: number;
  priority: Priority;
  reasons: string[];
}

export function scoreOrder(
  order: Order,
  items: OrderItem[],
  products: Product[],
  customerVip: boolean,
  now: number,
): PriorityResult {
  const reasons: string[] = [];
  let score = 0;

  const hoursLeft = (order.deadline - now) / HOUR;
  if (hoursLeft <= 8) {
    score += 40;
    reasons.push(
      hoursLeft < 0
        ? `Delivery deadline passed ${Math.abs(Math.round(hoursLeft))}h ago`
        : `Delivery deadline is within ${Math.max(1, Math.round(hoursLeft))} hours`,
    );
  } else if (hoursLeft <= 24) {
    score += 28;
    reasons.push("Delivery deadline is within 24 hours");
  } else if (hoursLeft <= 48) {
    score += 14;
    reasons.push("Delivery deadline is within 48 hours");
  }

  if (customerVip) {
    score += 20;
    reasons.push("Customer is VIP");
  }

  const ageHours = (now - order.createdAt) / HOUR;
  if (ageHours >= 36) {
    score += 15;
    reasons.push(`Order has been waiting ${Math.round(ageHours)}h`);
  } else if (ageHours >= 12) {
    score += 8;
    reasons.push("Order is ageing in the queue");
  }

  const orderItems = items.filter((i) => i.orderId === order.id);
  const fully = orderItems.every((i) => {
    const p = products.find((x) => x.id === i.productId);
    return p ? availableQty(p) + i.allocated >= i.quantity : false;
  });
  if (fully) {
    score += 15;
    reasons.push("Inventory is fully available");
  } else {
    reasons.push("Inventory is only partially available");
  }

  const value = orderValue(orderItems, products);
  if (value >= 4000) {
    score += 10;
    reasons.push(`High order value (${money(value)})`);
  } else if (value >= 1500) {
    score += 5;
    reasons.push(`Above-average order value (${money(value)})`);
  }

  return { score, priority: priorityFromScore(score), reasons };
}

export function priorityFromScore(score: number): Priority {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "NORMAL";
}

export const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, NORMAL: 1 };

export function orderValue(items: OrderItem[], products: Product[]) {
  return items.reduce((sum, i) => {
    const p = products.find((x) => x.id === i.productId);
    return sum + (p ? p.unitPrice * i.quantity : 0);
  }, 0);
}

export function orderItemsOf(state: WmsState, orderId: string) {
  return state.orderItems.filter((i) => i.orderId === orderId);
}

export function orderTotals(state: WmsState, orderId: string) {
  const items = orderItemsOf(state, orderId);
  return {
    items,
    quantity: items.reduce((s, i) => s + i.quantity, 0),
    value: orderValue(items, state.products),
  };
}

export const isDelayed = (o: Order, now: number) =>
  o.deadline < now && !["COMPLETED", "DISPATCHED", "CANCELLED"].includes(o.status);

/* ------------------------------- allocation ------------------------------- */

export interface AllocationLine {
  orderId: string;
  productId: string;
  productName: string;
  required: number;
  allocated: number;
  backordered: number;
  explanation: string;
}

/**
 * Priority-weighted allocation. Orders are sorted by priority score, then
 * deadline. Stock is never over-allocated; shortfalls become backorders.
 */
export function planAllocation(state: WmsState, orderIds: string[]): AllocationLine[] {
  const pool = new Map<string, number>();
  state.products.forEach((p) => pool.set(p.id, availableQty(p)));

  const queue = orderIds
    .map((id) => state.orders.find((o) => o.id === id)!)
    .filter(Boolean)
    .sort((a, b) => b.priorityScore - a.priorityScore || a.deadline - b.deadline);

  const lines: AllocationLine[] = [];
  for (const order of queue) {
    for (const item of orderItemsOf(state, order.id)) {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) continue;
      const need = item.quantity - item.allocated;
      if (need <= 0) continue;
      const free = pool.get(product.id) ?? 0;
      const give = Math.max(0, Math.min(need, free));
      pool.set(product.id, free - give);
      const short = need - give;
      lines.push({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        required: need,
        allocated: give,
        backordered: short,
        explanation:
          short === 0
            ? `${give} units allocated to ${order.id} — full requirement covered (${order.priority} priority, score ${order.priorityScore}).`
            : give === 0
              ? `No stock left for ${order.id}: higher-priority orders consumed available ${product.name}. ${short} units backordered.`
              : `${give} of ${need} units allocated to ${order.id} because it has ${order.priority} priority (score ${order.priorityScore}). Backorder created for ${short} units.`,
      });
    }
  }
  return lines;
}

/* --------------------------- picking optimization -------------------------- */

export function optimizeRoute(tasks: PickingTask[]) {
  const key = (t: PickingTask) => `${t.location.aisle}-${t.location.rack}-${t.location.shelf}`;
  const original = tasks.map(key);
  const optimized = [...tasks].sort(
    (a, b) =>
      a.location.aisle.localeCompare(b.location.aisle) ||
      a.location.rack.localeCompare(b.location.rack) ||
      a.location.shelf.localeCompare(b.location.shelf),
  );
  const walk = (list: string[]) => {
    let d = 0;
    for (let i = 1; i < list.length; i++) {
      const prevAisle = (list[i - 1] ?? "").split("-")[0];
      const aisle = (list[i] ?? "").split("-")[0];

      d += prevAisle === aisle ? 6 : 28;
    }
    return d;
  };
  const before = walk(original);
  const after = walk(optimized.map(key));
  const saved = Math.max(0, before - after);
  return {
    tasks: optimized,
    distanceBefore: before,
    distanceAfter: after,
    metersSaved: saved,
    minutesSaved: Math.round((saved / 45) * 10) / 10,
  };
}

/* --------------------------- bottleneck detection -------------------------- */

export const PIPELINE: { stage: OrderStatus; label: string; target: number }[] = [
  { stage: "NEW", label: "Intake", target: 10 },
  { stage: "ALLOCATED", label: "Allocation", target: 10 },
  { stage: "PICKING", label: "Picking", target: 12 },
  { stage: "PACKING", label: "Packing", target: 14 },
  { stage: "QUALITY_CHECK", label: "Quality Check", target: 10 },
  { stage: "READY_FOR_DISPATCH", label: "Dispatch", target: 12 },
];

export interface StageMetric {
  stage: OrderStatus;
  label: string;
  waiting: number;
  avgMinutes: number;
  target: number;
  bottleneck: boolean;
  loadPct: number;
}

export function stageMetrics(state: WmsState): StageMetric[] {
  const raw = PIPELINE.map((p) => {
    const inStage = state.orders.filter((o) => o.status === p.stage);
    const durations = state.orders
      .map((o) => o.stageDurations[p.stage])
      .filter((d): d is number => typeof d === "number");
    const live = inStage.map((o) => (state.clock - o.stageEnteredAt) / 60000);
    const all = [...durations, ...live];
    const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    return { ...p, waiting: inStage.length, avgMinutes: Math.round(avg) };
  });
  const maxAvg = Math.max(1, ...raw.map((r) => r.avgMinutes));
  return raw.map((r) => ({
    ...r,
    loadPct: Math.round((r.avgMinutes / maxAvg) * 100),
    bottleneck: r.avgMinutes > r.target * 1.4 && r.waiting > 0,
  }));
}

export function primaryBottleneck(state: WmsState) {
  const metrics = stageMetrics(state);
  const flagged = metrics.filter((m) => m.bottleneck);
  if (!flagged.length) return null;
  const worst = flagged.sort((a, b) => b.avgMinutes / b.target - a.avgMinutes / a.target)[0]!;
  const others = metrics.filter((m) => m.stage !== worst.stage && m.avgMinutes > 0);
  const baseline = others.length ? others.reduce((s, m) => s + m.avgMinutes, 0) / others.length : worst.target;
  const slowerPct = Math.round(((worst.avgMinutes - baseline) / Math.max(1, baseline)) * 100);
  const extraWorkers = Math.max(1, Math.ceil(worst.waiting / 4));
  return { ...worst, slowerPct, extraWorkers };
}

/* ------------------------------ recommendations ---------------------------- */

export interface Recommendation {
  id: string;
  kind: "shortage" | "reorder" | "bottleneck" | "delay" | "exception" | "healthy";
  severity: Severity;
  title: string;
  reason: string;
  action: string;
  actionLabel?: string;
  target?: string;
}

export function buildRecommendations(state: WmsState): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = state.clock;

  // 1. Shortage on urgent orders
  state.orders
    .filter((o) => ["NEW", "PRIORITIZED", "ALLOCATED", "BACKORDER"].includes(o.status))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .forEach((o) => {
      orderItemsOf(state, o.id).forEach((item) => {
        const p = state.products.find((x) => x.id === item.productId);
        if (!p) return;
        const need = item.quantity - item.allocated;
        if (need <= 0) return;
        const avail = availableQty(p);
        if (avail < need && recs.filter((r) => r.kind === "shortage").length < 4) {
          recs.push({
            id: `rec-short-${o.id}-${p.id}`,
            kind: "shortage",
            severity: o.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: `URGENT ORDER ALERT — ${o.id}`,
            reason: `${o.id} (${o.priority}) requires ${need} units of ${p.name} but only ${avail} are available.`,
            action: `Allocate ${avail} units now and create a backorder for ${need - avail} units.`,
            actionLabel: "Run smart allocation",
            target: o.id,
          });
        }
      });
    });

  // 2. Reorder alerts
  state.products
    .filter((p) => {
      const st = productStatus(state, p);
      return st === "LOW_STOCK" || st === "OUT_OF_STOCK";
    })
    .filter((p) => !state.reorders.some((r) => r.productId === p.id && r.status !== "REJECTED"))
    .slice(0, 4)
    .forEach((p) => {
      const qty = recommendedReorderQty(p);
      recs.push({
        id: `rec-reorder-${p.id}`,
        kind: "reorder",
        severity: availableQty(p) === 0 ? "CRITICAL" : "MEDIUM",
        title: `${availableQty(p) === 0 ? "OUT OF STOCK" : "LOW STOCK"} ALERT — ${p.name}`,
        reason: `${p.sku} has ${availableQty(p)} available units (reorder point ${reorderPoint(p, leadTimeFor(state, p))}, avg daily demand ${p.avgDailyDemand}).`,
        action: `Recommended reorder: ${qty} units.`,
        actionLabel: "Create reorder request",
        target: p.id,
      });
    });

  // 3. Bottleneck
  const bn = primaryBottleneck(state);
  if (bn) {
    recs.push({
      id: `rec-bottleneck-${bn.stage}`,
      kind: "bottleneck",
      severity: "HIGH",
      title: `BOTTLENECK ALERT — ${bn.label}`,
      reason: `${bn.label} is averaging ${bn.avgMinutes} min per order (${bn.slowerPct}% slower than the rest of the line) with ${bn.waiting} orders waiting.`,
      action: `Assign ${bn.extraWorkers} additional worker${bn.extraWorkers > 1 ? "s" : ""} to ${bn.label.toLowerCase()}.`,
      actionLabel: "View stage queue",
      target: bn.stage,
    });
  }

  // 4. Delay risk
  state.orders
    .filter(
      (o) =>
        !["COMPLETED", "DISPATCHED", "CANCELLED"].includes(o.status) &&
        o.deadline - now < 6 * HOUR &&
        o.priority !== "CRITICAL",
    )
    .slice(0, 3)
    .forEach((o) => {
      recs.push({
        id: `rec-delay-${o.id}`,
        kind: "delay",
        severity: o.deadline < now ? "CRITICAL" : "HIGH",
        title: `DELAY ALERT — ${o.id}`,
        reason: `${o.id} is in ${o.status.replaceAll("_", " ")} and its deadline is ${relative(o.deadline, now)}.`,
        action: "Increase priority and escalate to the front of the queue.",
        actionLabel: "Escalate priority",
        target: o.id,
      });
    });

  // 5. Open exceptions
  state.exceptions
    .filter((e) => e.status !== "RESOLVED")
    .slice(0, 3)
    .forEach((e) => {
      recs.push({
        id: `rec-exc-${e.id}`,
        kind: "exception",
        severity: e.severity,
        title: `EXCEPTION — ${e.type.replaceAll("_", " ")}`,
        reason: e.description,
        action: e.recommendedAction,
        actionLabel: "Resolve exception",
        target: e.id,
      });
    });

  if (!recs.length) {
    recs.push({
      id: "rec-healthy",
      kind: "healthy",
      severity: "LOW",
      title: "All clear",
      reason: "No shortages, bottlenecks or open exceptions detected in the current operating window.",
      action: "Keep monitoring — the assistant will raise decisions as conditions change.",
    });
  }

  return recs.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

export const severityRank = (s: Severity) => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 })[s];

/* --------------------------------- KPIs ---------------------------------- */

export function kpis(state: WmsState) {
  const o = state.orders;
  const count = (...st: OrderStatus[]) => o.filter((x) => st.includes(x.status)).length;
  const completed = count("COMPLETED");
  const lowStock = state.products.filter((p) => productStatus(state, p) === "LOW_STOCK").length;
  const outOfStock = state.products.filter((p) => productStatus(state, p) === "OUT_OF_STOCK").length;
  const durations = o
    .filter((x) => x.completedAt)
    .map((x) => (x.completedAt! - x.createdAt) / HOUR);
  return {
    total: o.length,
    pending: count("NEW", "PRIORITIZED", "ALLOCATED"),
    picking: count("PICKING"),
    packing: count("PACKING"),
    qc: count("QUALITY_CHECK"),
    readyForDispatch: count("READY_FOR_DISPATCH"),
    dispatched: count("DISPATCHED"),
    completed,
    backorder: count("BACKORDER"),
    exceptions: count("EXCEPTION"),
    lowStock,
    outOfStock,
    delayed: o.filter((x) => isDelayed(x, state.clock)).length,
    fulfillmentRate: o.length ? Math.round((completed / o.length) * 1000) / 10 : 0,
    avgFulfillmentHours: durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0,
    inventoryValue: state.products.reduce((s, p) => s + p.quantity * p.unitPrice, 0),
    openExceptions: state.exceptions.filter((e) => e.status !== "RESOLVED").length,
  };
}
