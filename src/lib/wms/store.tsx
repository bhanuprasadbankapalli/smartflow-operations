import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BASE_TIME,
  HOUR,
  availableQty,
  leadTimeFor,
  orderItemsOf,
  planAllocation,
  priorityFromScore,
  productStatus,
  recommendedReorderQty,
  reorderPoint,
  scoreOrder,
  type AllocationLine,
} from "./engine";
import { CHECKLIST_ITEMS, COURIERS, createSeedState } from "./seed";
import type {
  Notification,
  Order,
  OrderStatus,
  Product,
  Role,
  Severity,
  WarehouseException,
  WmsState,
} from "./types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`;

interface Ctx {
  state: WmsState;
  role: Role;
  setRole: (r: Role) => void;
  signedIn: boolean;
  signIn: (r?: Role) => void;
  signOut: () => void;
  actor: string;
  /* actions */
  runPrioritization: () => void;
  escalateOrder: (orderId: string) => void;
  runSmartAllocation: (orderIds?: string[]) => AllocationLine[];
  previewAllocation: (orderIds?: string[]) => AllocationLine[];
  startPicking: (taskId: string) => void;
  completePick: (taskId: string) => void;
  reportPickIssue: (taskId: string, kind: "MISSING" | "DAMAGED") => void;
  startPacking: (orderId: string) => void;
  completePacking: (orderId: string) => void;
  reportPackingIssue: (orderId: string) => void;
  submitQualityCheck: (orderId: string, checklist: Record<string, boolean>, pass: boolean, note?: string) => void;
  dispatchOrder: (orderId: string, courier: string) => void;
  advanceShipment: (shipmentId: string) => void;
  resolveException: (exceptionId: string) => void;
  adjustStock: (productId: string, delta: number, reason: string) => void;
  saveProduct: (p: Partial<Product> & { name: string }, id?: string) => void;
  createReorder: (productId: string) => void;
  setReorderStatus: (id: string, status: "APPROVED" | "REJECTED" | "ORDERED") => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  runDemoScenario: () => void;
  resetDemo: () => void;
}

const WmsContext = createContext<Ctx | null>(null);

export function WmsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WmsState>(() => createSeedState());
  const [role, setRole] = useState<Role>("manager");

  const actor = useMemo(() => {
    const u = state.users.find((x) => x.role === role);
    return u?.name ?? "Operator";
  }, [state.users, role]);

  const mutate = useCallback((fn: (draft: WmsState) => void) => {
    setState((prev) => {
      const draft = clone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  /* ------------------------------- helpers -------------------------------- */

  const log = (
    d: WmsState,
    kind: WmsState["activity"][number]["kind"],
    message: string,
    who = actor,
  ) => {
    d.activity.unshift({ id: uid("AL"), at: d.clock, actor: who, message, kind });
  };

  const notify = (d: WmsState, title: string, message: string, severity: Severity, link?: string) => {
    const n: Notification = {
      id: uid("N"),
      title,
      message,
      severity,
      createdAt: d.clock,
      read: false,
      link,
    };
    d.notifications.unshift(n);
  };

  const moveStage = (d: WmsState, order: Order, next: OrderStatus) => {
    const minutes = Math.max(1, Math.round((d.clock - order.stageEnteredAt) / 60000));
    order.stageDurations[order.status] = minutes;
    order.status = next;
    order.stageEnteredAt = d.clock;
  };

  const raiseException = (
    d: WmsState,
    partial: Omit<WarehouseException, "id" | "detectedAt" | "status">,
  ) => {
    const exc: WarehouseException = {
      ...partial,
      id: uid("EXC"),
      detectedAt: d.clock,
      status: "OPEN",
    };
    d.exceptions.unshift(exc);
    log(d, "exception", `Exception raised: ${exc.description}`);
    notify(d, exc.type.replaceAll("_", " "), exc.description, exc.severity, "/exceptions");
    return exc;
  };

  const stockCheck = (d: WmsState, productId: string, qty: number) => {
    const p = d.products.find((x) => x.id === productId);
    return p ? availableQty(p) >= qty : false;
  };

  /* -------------------------------- actions ------------------------------- */

  const runPrioritization = useCallback(() => {
    let changed = 0;
    mutate((d) => {
      d.orders.forEach((o) => {
        if (["COMPLETED", "DISPATCHED", "CANCELLED"].includes(o.status)) return;
        const vip = d.customers.find((c) => c.id === o.customerId)?.vip ?? false;
        const res = scoreOrder(o, d.orderItems, d.products, vip, d.clock);
        const before = o.priority;
        o.priorityScore = res.score;
        o.priority = res.priority;
        o.priorityReasons = res.reasons;
        if (o.status === "NEW") moveStage(d, o, "PRIORITIZED");
        if (before !== o.priority) {
          changed++;
          log(d, "order", `${o.id} re-prioritized ${before} → ${o.priority} (score ${o.priorityScore})`, "Prioritization engine");
        }
      });
    });
    toast.success("Prioritization engine finished", {
      description: `${changed} order${changed === 1 ? "" : "s"} changed priority band.`,
    });
  }, [mutate]);

  const escalateOrder = useCallback(
    (orderId: string) => {
      mutate((d) => {
        const o = d.orders.find((x) => x.id === orderId);
        if (!o) return;
        o.priorityScore = Math.min(100, o.priorityScore + 25);
        o.priority = priorityFromScore(o.priorityScore);
        o.priorityReasons = ["Manually escalated by manager (delay risk)", ...o.priorityReasons];
        log(d, "order", `${o.id} escalated to ${o.priority} (score ${o.priorityScore})`);
      });
      toast.success(`${orderId} escalated`, { description: "Order moved up the allocation queue." });
    },
    [mutate],
  );

  const candidateOrders = useCallback(
    (state: WmsState, orderIds?: string[]) =>
      orderIds ??
      state.orders
        .filter((o) => ["NEW", "PRIORITIZED", "ALLOCATED", "BACKORDER"].includes(o.status))
        .filter((o) => orderItemsOf(state, o.id).some((i) => i.quantity > i.allocated))
        .map((o) => o.id),
    [],
  );

  const previewAllocation = useCallback(
    (orderIds?: string[]) => planAllocation(state, candidateOrders(state, orderIds)),
    [state, candidateOrders],
  );

  const runSmartAllocation = useCallback(
    (orderIds?: string[]) => {
      const lines = planAllocation(state, candidateOrders(state, orderIds));
      mutate((d) => {
        lines.forEach((line) => {
          const item = d.orderItems.find((i) => i.orderId === line.orderId && i.productId === line.productId);
          const product = d.products.find((p) => p.id === line.productId);
          if (!item || !product) return;
          const give = Math.min(line.allocated, availableQty(product));
          item.allocated += give;
          item.backordered = item.quantity - item.allocated;
          product.reserved += give;
          product.lastUpdated = d.clock;
          if (give > 0) log(d, "inventory", `${give} units of ${product.name} allocated to ${line.orderId}`, "Allocation engine");
        });

        const touched = new Set(lines.map((l) => l.orderId));
        touched.forEach((orderId) => {
          const o = d.orders.find((x) => x.id === orderId);
          if (!o) return;
          const items = orderItemsOf(d, orderId);
          const short = items.filter((i) => i.backordered > 0);
          const notes = lines.filter((l) => l.orderId === orderId).map((l) => l.explanation);
          o.allocationNote = notes.join(" ");
          if (short.length && items.every((i) => i.allocated === 0)) {
            moveStage(d, o, "BACKORDER");
          } else if (short.length) {
            moveStage(d, o, "ALLOCATED");
            raiseException(d, {
              type: "STOCK_SHORTAGE",
              severity: o.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
              orderId: o.id,
              productId: short[0]?.productId,
              description: `${o.id} is short ${short.reduce((s, i) => s + i.backordered, 0)} units after priority allocation.`,
              analysis: "Available stock was consumed by higher-priority orders in the same allocation run.",
              decision: "Partial allocation applied; backorder created for the shortfall.",
              recommendedAction: "Approve a replenishment reorder and keep the partial pick moving.",
            });
          } else {
            moveStage(d, o, "ALLOCATED");
          }
        });
      });
      const allocated = lines.reduce((s, l) => s + l.allocated, 0);
      const back = lines.reduce((s, l) => s + l.backordered, 0);
      toast.success("Smart allocation complete", {
        description: `${allocated} units allocated by priority · ${back} units backordered.`,
      });
      return lines;
    },
    [state, mutate, candidateOrders],
  );

  const startPicking = useCallback(
    (taskId: string) => {
      mutate((d) => {
        const t = d.pickingTasks.find((x) => x.id === taskId);
        if (!t) return;
        t.status = "IN_PROGRESS";
        t.startedAt = d.clock;
        const o = d.orders.find((x) => x.id === t.orderId);
        if (o && !["PICKING", "EXCEPTION"].includes(o.status)) moveStage(d, o, "PICKING");
        log(d, "picking", `${actor} started picking ${t.quantity} × ${d.products.find((p) => p.id === t.productId)?.name} for ${t.orderId}`);
      });
      toast.info("Picking started");
    },
    [mutate, actor],
  );

  const completePick = useCallback(
    (taskId: string) => {
      mutate((d) => {
        const t = d.pickingTasks.find((x) => x.id === taskId);
        if (!t) return;
        t.status = "COMPLETED";
        t.pickedQuantity = t.quantity;
        t.completedAt = d.clock;
        const item = d.orderItems.find((i) => i.orderId === t.orderId && i.productId === t.productId);
        if (item) item.picked = t.quantity;
        log(d, "picking", `${t.quantity} units picked for ${t.orderId} from ${t.location.rack}`);

        const siblings = d.pickingTasks.filter((x) => x.orderId === t.orderId);
        const allDone = siblings.every((x) => x.status === "COMPLETED");
        const o = d.orders.find((x) => x.id === t.orderId);
        if (o && allDone && o.status !== "EXCEPTION") {
          moveStage(d, o, "PACKING");
          const weight =
            Math.round(
              orderItemsOf(d, o.id).reduce((s, i) => {
                const p = d.products.find((x) => x.id === i.productId);
                return s + (p ? p.weightKg * i.picked : 0);
              }, 0) * 10,
            ) / 10;
          d.packingTasks.unshift({
            id: uid("PK"),
            orderId: o.id,
            status: "WAITING",
            packaging: weight > 20 ? "Pallet + stretch wrap" : weight > 5 ? "Large corrugated box" : "Medium corrugated box",
            weightKg: weight,
          });
          log(d, "packing", `${o.id} moved to PACKING — packing task created`, "System");
        }
      });
      toast.success("Item picked", { description: "Order advances automatically once all lines are picked." });
    },
    [mutate],
  );

  const reportPickIssue = useCallback(
    (taskId: string, kind: "MISSING" | "DAMAGED") => {
      mutate((d) => {
        const t = d.pickingTasks.find((x) => x.id === taskId);
        if (!t) return;
        t.status = kind;
        const p = d.products.find((x) => x.id === t.productId);
        const o = d.orders.find((x) => x.id === t.orderId);
        if (!p || !o) return;
        if (kind === "DAMAGED") {
          p.damaged += t.quantity;
          p.reserved = Math.max(0, p.reserved - t.quantity);
          p.lastUpdated = d.clock;
          d.movements.unshift({
            id: uid("MV"),
            productId: p.id,
            at: d.clock,
            delta: 0,
            reason: `${t.quantity} units quarantined as damaged (${o.id})`,
            actor,
            balance: p.quantity,
          });
        }
        const replacement = stockCheck(d, p.id, t.quantity);
        raiseException(d, {
          type: kind === "MISSING" ? "MISSING_ITEM" : "DAMAGED_ITEM",
          severity: o.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
          orderId: o.id,
          productId: p.id,
          description:
            kind === "MISSING"
              ? `${t.quantity} units of ${p.name} could not be located at ${p.location.rack}.`
              : `${t.quantity} units of ${p.name} are damaged on ${o.id}.`,
          analysis: replacement
            ? `Inventory check: ${availableQty(p)} replacement units available in aisle ${p.location.aisle}.`
            : `Inventory check: no replacement stock of ${p.name} available.`,
          decision: replacement
            ? "Replace affected units from available inventory and re-issue the picking task."
            : "Create backorder for the affected units and notify the manager.",
          recommendedAction: replacement
            ? `Allocate ${t.quantity} replacement units and resume picking for ${o.id}.`
            : `Raise a reorder for ${p.name} and hold ${o.id}.`,
        });
        moveStage(d, o, "EXCEPTION");
      });
      toast.error(`Reported as ${kind.toLowerCase()}`, {
        description: "Exception raised — the system has analysed it and proposed a decision.",
      });
    },
    [mutate, actor],
  );

  const startPacking = useCallback(
    (orderId: string) => {
      mutate((d) => {
        const t = d.packingTasks.find((x) => x.orderId === orderId);
        if (!t) return;
        t.status = "IN_PROGRESS";
        t.startedAt = d.clock;
        log(d, "packing", `${actor} started packing ${orderId}`);
      });
      toast.info("Packing started");
    },
    [mutate, actor],
  );

  const completePacking = useCallback(
    (orderId: string) => {
      let blocked = false;
      mutate((d) => {
        const t = d.packingTasks.find((x) => x.orderId === orderId);
        const o = d.orders.find((x) => x.id === orderId);
        if (!t || !o) return;
        const items = orderItemsOf(d, orderId);
        const mismatch = items.filter((i) => i.picked < i.allocated);
        if (mismatch.length) {
          blocked = true;
          t.status = "BLOCKED";
          t.verification = "Packing verification failed — picked quantities do not match allocated lines.";
          return;
        }
        items.forEach((i) => {
          const item = d.orderItems.find((x) => x.id === i.id);
          if (item) item.packed = item.picked;
        });
        t.status = "COMPLETED";
        t.completedAt = d.clock;
        t.verification = "Packing verification passed — picked quantities match order lines.";
        moveStage(d, o, "QUALITY_CHECK");
        d.qualityChecks.unshift({
          id: uid("QC"),
          orderId,
          checklist: Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c, false])),
          result: "PENDING",
        });
        log(d, "packing", `Packing completed for ${orderId} — moved to QUALITY_CHECK`);
      });
      if (blocked) {
        toast.error("Packing verification failed", { description: "Missing items detected — order cannot be packed." });
      } else {
        toast.success("Packing completed", { description: "Order moved to quality check." });
      }
    },
    [mutate],
  );

  const reportPackingIssue = useCallback(
    (orderId: string) => {
      mutate((d) => {
        const o = d.orders.find((x) => x.id === orderId);
        const t = d.packingTasks.find((x) => x.orderId === orderId);
        if (!o) return;
        if (t) t.status = "BLOCKED";
        raiseException(d, {
          type: "PACKING_ERROR",
          severity: "HIGH",
          orderId,
          description: `Missing item reported during packing of ${orderId}.`,
          analysis: "Packed quantities do not reconcile with picked quantities.",
          decision: "Return the order to picking and re-verify the affected lines.",
          recommendedAction: `Re-issue picking tasks for ${orderId} and re-run packing verification.`,
        });
        moveStage(d, o, "EXCEPTION");
      });
      toast.error("Packing exception raised");
    },
    [mutate],
  );

  const submitQualityCheck = useCallback(
    (orderId: string, checklist: Record<string, boolean>, pass: boolean, note?: string) => {
      mutate((d) => {
        const qc = d.qualityChecks.find((x) => x.orderId === orderId);
        const o = d.orders.find((x) => x.id === orderId);
        if (!o) return;
        if (qc) {
          qc.checklist = checklist;
          qc.result = pass ? "PASSED" : "FAILED";
          qc.inspector = actor;
          qc.checkedAt = d.clock;
          qc.note = note;
        }
        if (pass) {
          moveStage(d, o, "READY_FOR_DISPATCH");
          const pk = d.packingTasks.find((x) => x.orderId === orderId);
          d.shipments.unshift({
            id: uid("SH"),
            orderId,
            courier: COURIERS[0]!,
            trackingId: `TRK${Math.floor(100000 + Math.random() * 899999)}IN`,
            weightKg: pk?.weightKg ?? 1,
            destination: o.destination,
            status: "READY",
          });
          log(d, "quality", `Quality check passed for ${orderId} — ready for dispatch`);
        } else {
          const failed = Object.entries(checklist)
            .filter(([, v]) => !v)
            .map(([k]) => k);
          raiseException(d, {
            type: "QUALITY_FAILURE",
            severity: "HIGH",
            orderId,
            description: `Quality check failed for ${orderId}: ${failed.join(", ") || "inspector rejection"}.`,
            analysis: "One or more checklist criteria were not satisfied at final inspection.",
            decision: "Return the order to packing for correction and re-inspection.",
            recommendedAction: `Re-pack ${orderId}, correct the failed criteria and re-run the quality check.`,
          });
          moveStage(d, o, "EXCEPTION");
          log(d, "quality", `Quality check FAILED for ${orderId}`);
        }
      });
      toast[pass ? "success" : "error"](pass ? "Quality check passed" : "Quality check failed", {
        description: pass ? "Shipment record created and order is ready for dispatch." : "Exception raised automatically.",
      });
    },
    [mutate, actor],
  );

  const dispatchOrder = useCallback(
    (orderId: string, courier: string) => {
      let ok = true;
      mutate((d) => {
        const o = d.orders.find((x) => x.id === orderId);
        const qc = d.qualityChecks.find((x) => x.orderId === orderId);
        if (!o) return;
        if (o.status !== "READY_FOR_DISPATCH" || qc?.result !== "PASSED") {
          ok = false;
          return;
        }
        const sh = d.shipments.find((x) => x.orderId === orderId);
        if (sh) {
          sh.status = "DISPATCHED";
          sh.courier = courier;
          sh.dispatchedAt = d.clock;
        }
        // consume inventory: reserved -> shipped
        orderItemsOf(d, orderId).forEach((i) => {
          const p = d.products.find((x) => x.id === i.productId);
          if (!p) return;
          const qty = Math.min(i.packed || i.allocated, p.quantity);
          p.reserved = Math.max(0, p.reserved - qty);
          p.quantity = Math.max(0, p.quantity - qty);
          p.lastUpdated = d.clock;
          d.movements.unshift({
            id: uid("MV"),
            productId: p.id,
            at: d.clock,
            delta: -qty,
            reason: `Dispatched with ${orderId}`,
            actor,
            balance: p.quantity,
          });
          if (productStatus(d, p) !== "IN_STOCK") {
            notify(
              d,
              availableQty(p) === 0 ? "Out of stock" : "Low stock",
              `${p.name} dropped to ${availableQty(p)} available units after dispatching ${orderId}.`,
              availableQty(p) === 0 ? "CRITICAL" : "MEDIUM",
              "/inventory",
            );
          }
        });
        moveStage(d, o, "DISPATCHED");
        log(d, "dispatch", `${orderId} dispatched via ${courier} — inventory updated`);
      });
      if (ok) toast.success(`${orderId} dispatched`, { description: "Inventory reduced and activity logged." });
      else toast.error("Cannot dispatch", { description: "Order must pass quality check before dispatch." });
    },
    [mutate, actor],
  );

  const advanceShipment = useCallback(
    (shipmentId: string) => {
      mutate((d) => {
        const sh = d.shipments.find((x) => x.id === shipmentId);
        if (!sh) return;
        const next: Record<string, typeof sh.status> = {
          READY: "DISPATCHED",
          DISPATCHED: "IN_TRANSIT",
          IN_TRANSIT: "DELIVERED",
          DELIVERED: "DELIVERED",
        };
        sh.status = next[sh.status]!;
        if (sh.status === "DELIVERED") {
          sh.deliveredAt = d.clock;
          const o = d.orders.find((x) => x.id === sh.orderId);
          if (o) {
            moveStage(d, o, "COMPLETED");
            o.completedAt = d.clock;
            log(d, "order", `${o.id} delivered and completed`);
          }
        } else {
          log(d, "dispatch", `${sh.orderId} shipment status → ${sh.status}`);
        }
      });
      toast.success("Shipment updated");
    },
    [mutate],
  );

  const resolveException = useCallback(
    (exceptionId: string) => {
      mutate((d) => {
        const e = d.exceptions.find((x) => x.id === exceptionId);
        if (!e) return;
        e.status = "RESOLVED";
        e.resolvedAt = d.clock;
        e.resolution = e.decision;
        const o = e.orderId ? d.orders.find((x) => x.id === e.orderId) : undefined;
        if (o && o.status === "EXCEPTION") {
          const items = orderItemsOf(d, o.id);
          const allPicked = items.every((i) => i.picked >= i.allocated && i.allocated > 0);
          moveStage(d, o, allPicked ? "PACKING" : "PICKING");
          d.pickingTasks
            .filter((t) => t.orderId === o.id && ["MISSING", "DAMAGED"].includes(t.status))
            .forEach((t) => {
              t.status = "ASSIGNED";
              t.startedAt = undefined;
            });
          if (!allPicked && !d.pickingTasks.some((t) => t.orderId === o.id)) {
            items.forEach((i) => {
              const p = d.products.find((x) => x.id === i.productId)!;
              d.pickingTasks.unshift({
                id: uid("PT"),
                orderId: o.id,
                productId: p.id,
                workerId: o.assignedWorkerId ?? d.users.find((u) => u.role === "worker")!.id,
                quantity: i.allocated,
                pickedQuantity: 0,
                location: p.location,
                priority: o.priority,
                status: "ASSIGNED",
              });
            });
          }
        }
        log(d, "exception", `Exception ${e.id} resolved — ${e.decision}`);
      });
      toast.success("Exception resolved", { description: "Order returned to the fulfilment flow." });
    },
    [mutate],
  );

  const adjustStock = useCallback(
    (productId: string, delta: number, reason: string) => {
      let rejected = false;
      mutate((d) => {
        const p = d.products.find((x) => x.id === productId);
        if (!p) return;
        if (p.quantity + delta < p.reserved) {
          rejected = true;
          return;
        }
        p.quantity += delta;
        p.lastUpdated = d.clock;
        d.movements.unshift({
          id: uid("MV"),
          productId,
          at: d.clock,
          delta,
          reason,
          actor,
          balance: p.quantity,
        });
        log(d, "inventory", `Stock adjusted for ${p.name}: ${delta > 0 ? "+" : ""}${delta} (${reason})`);
        if (productStatus(d, p) === "OUT_OF_STOCK")
          notify(d, "Out of stock", `${p.name} is out of stock.`, "CRITICAL", "/inventory");
      });
      if (rejected)
        toast.error("Adjustment blocked", {
          description: "Resulting stock would be lower than the quantity already reserved for orders.",
        });
      else toast.success("Stock adjusted");
    },
    [mutate, actor],
  );

  const saveProduct = useCallback(
    (input: Partial<Product> & { name: string }, id?: string) => {
      mutate((d) => {
        if (id) {
          const p = d.products.find((x) => x.id === id);
          if (!p) return;
          Object.assign(p, input);
          p.lastUpdated = d.clock;
          log(d, "inventory", `Product ${p.sku} updated`);
        } else {
          const idx = d.products.length + 1;
          const p: Product = {
            id: uid("P"),
            sku: input.sku ?? `SKU-${200 + idx}`,
            name: input.name,
            categoryId: input.categoryId ?? d.categories[0]!.id,
            supplierId: input.supplierId ?? d.suppliers[0]!.id,
            unitPrice: input.unitPrice ?? 0,
            weightKg: input.weightKg ?? 1,
            quantity: input.quantity ?? 0,
            reserved: 0,
            damaged: 0,
            minStock: input.minStock ?? 10,
            maxStock: input.maxStock ?? 100,
            avgDailyDemand: input.avgDailyDemand ?? 5,
            safetyStock: input.safetyStock ?? 10,
            location: input.location ?? { aisle: "A", rack: "A-01", shelf: "01" },
            lastUpdated: d.clock,
          };
          d.products.push(p);
          log(d, "inventory", `Product ${p.name} (${p.sku}) added to catalogue`);
        }
      });
      toast.success(id ? "Product updated" : "Product added");
    },
    [mutate],
  );

  const createReorder = useCallback(
    (productId: string) => {
      mutate((d) => {
        const p = d.products.find((x) => x.id === productId);
        if (!p) return;
        const qty = recommendedReorderQty(p);
        d.reorders.unshift({
          id: uid("RO"),
          productId,
          quantity: qty,
          reason: `Available ${availableQty(p)} ≤ reorder point ${reorderPoint(p, leadTimeFor(d, p))} (demand ${p.avgDailyDemand}/day, lead time ${leadTimeFor(d, p)}d, safety ${p.safetyStock})`,
          status: "RECOMMENDED",
          createdAt: d.clock,
        });
        log(d, "inventory", `Reorder recommendation created for ${p.name}: ${qty} units`, "Reorder engine");
      });
      toast.success("Reorder recommendation created");
    },
    [mutate],
  );

  const setReorderStatus = useCallback(
    (id: string, status: "APPROVED" | "REJECTED" | "ORDERED") => {
      mutate((d) => {
        const ro = d.reorders.find((x) => x.id === id);
        if (!ro) return;
        ro.status = status;
        const p = d.products.find((x) => x.id === ro.productId);
        log(d, "inventory", `Reorder ${ro.id} for ${p?.name} marked ${status}`);
        if (status === "ORDERED" && p) {
          p.quantity += ro.quantity;
          p.lastUpdated = d.clock;
          d.movements.unshift({
            id: uid("MV"),
            productId: p.id,
            at: d.clock,
            delta: ro.quantity,
            reason: `Purchase order received (${ro.id})`,
            actor,
            balance: p.quantity,
          });
        }
      });
      toast.success(`Reorder ${status.toLowerCase()}`);
    },
    [mutate, actor],
  );

  const markNotificationRead = useCallback(
    (id: string) => mutate((d) => { const n = d.notifications.find((x) => x.id === id); if (n) n.read = true; }),
    [mutate],
  );

  const markAllNotificationsRead = useCallback(
    () => mutate((d) => d.notifications.forEach((n) => (n.read = true))),
    [mutate],
  );

  const runDemoScenario = useCallback(() => {
    mutate((d) => {
      const helmet = d.products.find((p) => p.name === "Industrial Safety Helmet");
      if (!helmet) return;
      // reset the scenario to a clean 7 available units
      d.orders = d.orders.filter((o) => !["ORD-5001", "ORD-5002"].includes(o.id));
      d.orderItems = d.orderItems.filter((i) => !["ORD-5001", "ORD-5002"].includes(i.orderId));
      d.exceptions = d.exceptions.filter((e) => !["ORD-5001", "ORD-5002"].includes(e.orderId ?? ""));
      helmet.reserved = 0;
      helmet.damaged = 0;
      helmet.quantity = 7;
      helmet.lastUpdated = d.clock;

      const mk = (id: string, customerIdx: number, qty: number, deadlineHours: number, score: number) => {
        const customer = d.customers[customerIdx]!;
        const order: Order = {
          id,
          customerId: customer.id,
          createdAt: d.clock - 6 * HOUR,
          deadline: d.clock + deadlineHours * HOUR,
          status: "PRIORITIZED",
          priority: priorityFromScore(score),
          priorityScore: score,
          priorityReasons:
            score >= 80
              ? [`Delivery deadline is within ${deadlineHours} hours`, "Customer is VIP", "High order value"]
              : ["Delivery deadline is over 48 hours away", "Standard customer tier"],
          destination: `${customer.city}, IN`,
          stageEnteredAt: d.clock - 30 * 60000,
          stageDurations: {},
        };
        d.orders.unshift(order);
        d.orderItems.push({
          id: uid("OI"),
          orderId: id,
          productId: helmet.id,
          quantity: qty,
          allocated: 0,
          picked: 0,
          packed: 0,
          backordered: 0,
        });
        log(d, "order", `${id} created — ${qty} × Industrial Safety Helmet, ${order.priority} priority (score ${score})`, "Demo scenario");
      };
      mk("ORD-5001", 0, 10, 6, 85);
      mk("ORD-5002", 3, 5, 72, 32);

      notify(
        d,
        "Stock shortage detected",
        "Industrial Safety Helmet: 7 available units against 15 units of competing demand.",
        "CRITICAL",
        "/smart-decisions",
      );
      log(d, "system", "Demo scenario armed: competing demand for Industrial Safety Helmet (7 units available)", "Demo scenario");
    });
    toast.success("Demo scenario armed", {
      description: "ORD-5001 (CRITICAL, 10 units) vs ORD-5002 (NORMAL, 5 units) — 7 helmets available. Run smart allocation.",
      duration: 6000,
    });
  }, [mutate]);

  const resetDemo = useCallback(() => {
    setState(createSeedState());
    toast.success("Warehouse reset", { description: "Seed data restored to the demo baseline." });
  }, []);

  const value: Ctx = {
    state,
    role,
    setRole,
    actor,
    runPrioritization,
    escalateOrder,
    runSmartAllocation,
    previewAllocation,
    startPicking,
    completePick,
    reportPickIssue,
    startPacking,
    completePacking,
    reportPackingIssue,
    submitQualityCheck,
    dispatchOrder,
    advanceShipment,
    resolveException,
    adjustStock,
    saveProduct,
    createReorder,
    setReorderStatus,
    markNotificationRead,
    markAllNotificationsRead,
    runDemoScenario,
    resetDemo,
  };

  return <WmsContext.Provider value={value}>{children}</WmsContext.Provider>;
}

export function useWms() {
  const ctx = useContext(WmsContext);
  if (!ctx) throw new Error("useWms must be used inside WmsProvider");
  return ctx;
}

export { BASE_TIME };
