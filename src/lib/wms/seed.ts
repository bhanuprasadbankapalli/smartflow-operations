import { BASE_TIME, DAY, HOUR, availableQty, orderValue, priorityFromScore, scoreOrder } from "./engine";
import type {
  ActivityLog,
  Category,
  Customer,
  Notification,
  Order,
  OrderItem,
  OrderStatus,
  PackingTask,
  PickingTask,
  Product,
  QualityCheck,
  Shipment,
  StockMovement,
  Supplier,
  User,
  WarehouseException,
  WmsState,
} from "./types";

/** deterministic PRNG so SSR and client render identical data */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = rng(20260816);
const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;

export const CHECKLIST_ITEMS = [
  "Correct product",
  "Correct quantity",
  "Product condition",
  "Packaging integrity",
  "Order label",
  "Customer information",
];

const SUPPLIERS: Supplier[] = [
  { id: "SUP-01", name: "Northwind Industrial", contact: "ops@northwind.co", leadTimeDays: 3, reliability: 96 },
  { id: "SUP-02", name: "Meridian Electronics", contact: "supply@meridian.io", leadTimeDays: 5, reliability: 91 },
  { id: "SUP-03", name: "Ironhold Safety Co.", contact: "sales@ironhold.com", leadTimeDays: 2, reliability: 98 },
  { id: "SUP-04", name: "Panacea Packaging", contact: "hello@panacea.pk", leadTimeDays: 4, reliability: 88 },
  { id: "SUP-05", name: "Volta Power Systems", contact: "orders@voltaps.com", leadTimeDays: 6, reliability: 84 },
];

const CATEGORIES: Category[] = [
  { id: "CAT-01", name: "Electronics" },
  { id: "CAT-02", name: "Safety Equipment" },
  { id: "CAT-03", name: "Tools" },
  { id: "CAT-04", name: "Packaging" },
  { id: "CAT-05", name: "Power & Energy" },
  { id: "CAT-06", name: "Accessories" },
];

const PRODUCT_DEFS: [string, string, string, number, number][] = [
  // name, categoryId, supplierId, unitPrice, weightKg
  ["Laptop Pro 15", "CAT-01", "SUP-02", 1450, 2.1],
  ["Wireless Mouse", "CAT-01", "SUP-02", 28, 0.12],
  ["Mechanical Keyboard", "CAT-01", "SUP-02", 89, 0.95],
  ["27\" IPS Monitor", "CAT-01", "SUP-02", 265, 5.4],
  ["USB-C Dock Station", "CAT-01", "SUP-02", 149, 0.45],
  ["Barcode Scanner X2", "CAT-01", "SUP-02", 210, 0.3],
  ["Industrial Safety Helmet", "CAT-02", "SUP-03", 42, 0.6],
  ["Cut-Resistant Gloves", "CAT-02", "SUP-03", 14, 0.18],
  ["Hi-Vis Safety Vest", "CAT-02", "SUP-03", 19, 0.25],
  ["Safety Goggles Pro", "CAT-02", "SUP-03", 23, 0.1],
  ["Steel Toe Boots", "CAT-02", "SUP-03", 96, 1.6],
  ["Ear Defenders 32dB", "CAT-02", "SUP-03", 31, 0.28],
  ["Cordless Drill 18V", "CAT-03", "SUP-01", 175, 1.9],
  ["Torque Wrench Set", "CAT-03", "SUP-01", 132, 3.2],
  ["Angle Grinder 900W", "CAT-03", "SUP-01", 118, 2.6],
  ["Digital Caliper", "CAT-03", "SUP-01", 46, 0.22],
  ["Pallet Jack 2.5T", "CAT-03", "SUP-01", 640, 78],
  ["Heat Gun 2000W", "CAT-03", "SUP-01", 74, 1.1],
  ["Corrugated Box L", "CAT-04", "SUP-04", 2, 0.4],
  ["Corrugated Box M", "CAT-04", "SUP-04", 1.4, 0.3],
  ["Stretch Wrap Roll", "CAT-04", "SUP-04", 12, 2.4],
  ["Bubble Wrap 50m", "CAT-04", "SUP-04", 18, 1.8],
  ["Packing Tape Pack", "CAT-04", "SUP-04", 9, 0.9],
  ["Thermal Label Roll", "CAT-04", "SUP-04", 22, 0.7],
  ["Li-Ion Battery Pack", "CAT-05", "SUP-05", 310, 4.2],
  ["Solar Charge Controller", "CAT-05", "SUP-05", 185, 1.3],
  ["Industrial UPS 3kVA", "CAT-05", "SUP-05", 890, 22],
  ["Power Strip 8-Way", "CAT-06", "SUP-05", 34, 0.7],
  ["Cable Management Kit", "CAT-06", "SUP-01", 26, 0.55],
  ["Forklift LED Beacon", "CAT-06", "SUP-01", 58, 0.4],
];

const AISLES = ["A", "B", "C", "D", "E"];

const CUSTOMER_NAMES = [
  "Vertex Logistics",
  "Blue Harbor Retail",
  "Nova Manufacturing",
  "Kraft & Sons",
  "Ridgeway Constructions",
  "Helios Energy",
  "Summit Tools Ltd",
  "Orion Fulfilment",
  "Trident Marine",
  "Pinecrest Labs",
  "Cobalt Systems",
  "Redstone Mining",
  "Arcadia Hospitals",
  "Beacon Schools Group",
  "Ironclad Security",
  "Lumen Interiors",
  "Delta Freight",
  "Sierra Agrotech",
  "Northgate Utilities",
  "Zenith Robotics",
];

const CITIES = ["Hyderabad", "Pune", "Chennai", "Bengaluru", "Mumbai", "Kochi", "Delhi", "Ahmedabad"];

const WORKER_NAMES = [
  "John Mathews",
  "Priya Nair",
  "Diego Ramos",
  "Aisha Khan",
  "Tomas Berg",
  "Leila Haddad",
  "Marcus Obi",
  "Sofia Rossi",
  "Ravi Verma",
  "Hana Kimura",
];

const COURIERS = ["BlueDart Express", "SwiftShip Cargo", "Meridian Freight", "Delhivery Prime"];

const STAGE_PLAN: OrderStatus[] = [
  ...Array<OrderStatus>(5).fill("NEW"),
  ...Array<OrderStatus>(3).fill("PRIORITIZED"),
  ...Array<OrderStatus>(4).fill("ALLOCATED"),
  ...Array<OrderStatus>(5).fill("PICKING"),
  ...Array<OrderStatus>(5).fill("PACKING"),
  ...Array<OrderStatus>(3).fill("QUALITY_CHECK"),
  ...Array<OrderStatus>(3).fill("READY_FOR_DISPATCH"),
  ...Array<OrderStatus>(3).fill("DISPATCHED"),
  ...Array<OrderStatus>(6).fill("COMPLETED"),
  ...Array<OrderStatus>(2).fill("BACKORDER"),
  "EXCEPTION",
];

const STAGE_MINUTES: Partial<Record<OrderStatus, [number, number]>> = {
  NEW: [4, 12],
  ALLOCATED: [5, 11],
  PICKING: [7, 14],
  PACKING: [22, 38],
  QUALITY_CHECK: [5, 9],
  READY_FOR_DISPATCH: [8, 16],
};

export function createSeedState(): WmsState {
  const now = BASE_TIME;

  const products: Product[] = PRODUCT_DEFS.map(([name, categoryId, supplierId, unitPrice, weightKg], i) => {
    const demand = int(3, 18);
    const safety = int(5, 20);
    const maxStock = int(90, 320);
    // deliberately stock a spread: healthy, low, out-of-stock
    let quantity = int(40, 260);
    if (i % 7 === 3) quantity = int(4, 18); // low stock
    if (i % 11 === 5) quantity = 0; // out of stock
    if (name === "Industrial Safety Helmet") quantity = 7; // demo scenario product
    if (name === "Wireless Mouse") quantity = 8;
    return {
      id: `P-${String(i + 1).padStart(3, "0")}`,
      sku: `SKU-${100 + i}`,
      name,
      categoryId,
      supplierId,
      unitPrice,
      weightKg,
      quantity,
      reserved: 0,
      damaged: i % 13 === 4 ? int(1, 3) : 0,
      minStock: safety,
      maxStock,
      avgDailyDemand: demand,
      safetyStock: safety,
      location: {
        aisle: AISLES[i % AISLES.length]!,
        rack: `${AISLES[i % AISLES.length]}-${String(int(1, 9)).padStart(2, "0")}`,
        shelf: String(int(1, 4)).padStart(2, "0"),
      },
      lastUpdated: now - int(1, 40) * HOUR,
    };
  });

  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => ({
    id: `C-${String(i + 1).padStart(2, "0")}`,
    name,
    city: CITIES[i % CITIES.length]!,
    vip: i % 4 === 0,
  }));

  const users: User[] = [
    { id: "U-000", name: "Meera Sharma", role: "manager", shift: "General", activeTasks: 0 },
    ...WORKER_NAMES.map((name, i) => ({
      id: `U-${String(i + 1).padStart(3, "0")}`,
      name,
      role: "worker" as const,
      shift: i % 2 === 0 ? "Shift A (06:00-14:00)" : "Shift B (14:00-22:00)",
      activeTasks: 0,
    })),
    { id: "U-900", name: "Karan Iyer", role: "dispatcher", shift: "Shift A (06:00-14:00)", activeTasks: 0 },
  ];
  const workers = users.filter((u) => u.role === "worker");

  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  const pickingTasks: PickingTask[] = [];
  const packingTasks: PackingTask[] = [];
  const qualityChecks: QualityCheck[] = [];
  const shipments: Shipment[] = [];
  const exceptions: WarehouseException[] = [];
  const movements: StockMovement[] = [];
  const activity: ActivityLog[] = [];
  const notifications: Notification[] = [];

  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  STAGE_PLAN.forEach((status, idx) => {
    const id = `ORD-${1001 + idx}`;
    const customer = customers[idx % customers.length]!;
    const createdAt = now - int(3, 70) * HOUR;
    const urgent = idx % 6 === 0;
    const deadline = createdAt + (urgent ? int(6, 20) : int(30, 96)) * HOUR;
    const stageEnteredAt = now - int(5, 180) * 60000;

    const stageDurations: Partial<Record<OrderStatus, number>> = {};
    const orderStages: OrderStatus[] = [
      "NEW",
      "ALLOCATED",
      "PICKING",
      "PACKING",
      "QUALITY_CHECK",
      "READY_FOR_DISPATCH",
    ];
    const reachedIdx = orderStages.indexOf(status);
    orderStages.forEach((st, i) => {
      const range = STAGE_MINUTES[st];
      if (!range) return;
      const done = reachedIdx === -1 ? i < 4 : i < reachedIdx;
      if (done || ["DISPATCHED", "COMPLETED"].includes(status)) {
        stageDurations[st] = int(range[0], range[1]);
      }
    });

    const order: Order = {
      id,
      customerId: customer.id,
      createdAt,
      deadline,
      status,
      priority: "NORMAL",
      priorityScore: 0,
      priorityReasons: [],
      destination: `${customer.city}, IN`,
      stageEnteredAt,
      stageDurations,
      assignedWorkerId: ["PICKING", "PACKING", "QUALITY_CHECK"].includes(status)
        ? pick(workers).id
        : undefined,
    };

    const itemCount = int(1, 3);
    const used = new Set<string>();
    for (let i = 0; i < itemCount; i++) {
      const product = products[int(0, products.length - 1)]!;
      if (used.has(product.id)) continue;
      used.add(product.id);
      orderItems.push({
        id: nextId("OI"),
        orderId: id,
        productId: product.id,
        quantity: int(1, 8),
        allocated: 0,
        picked: 0,
        packed: 0,
        backordered: 0,
      });
    }
    orders.push(order);
  });

  // score & prioritize
  orders.forEach((o) => {
    const vip = customers.find((c) => c.id === o.customerId)?.vip ?? false;
    const res = scoreOrder(o, orderItems, products, vip, now);
    o.priorityScore = res.score;
    o.priority = priorityFromScore(res.score);
    o.priorityReasons = res.reasons;
  });

  const beyondAllocation: OrderStatus[] = [
    "ALLOCATED",
    "PICKING",
    "PACKING",
    "QUALITY_CHECK",
    "READY_FOR_DISPATCH",
    "DISPATCHED",
    "COMPLETED",
    "EXCEPTION",
  ];

  // allocate stock for orders that have progressed, highest priority first
  [...orders]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .forEach((o) => {
      if (!beyondAllocation.includes(o.status) && o.status !== "BACKORDER") return;
      const items = orderItems.filter((i) => i.orderId === o.id);
      items.forEach((item) => {
        const p = products.find((x) => x.id === item.productId)!;
        const give = Math.min(item.quantity, availableQty(p));
        item.allocated = o.status === "BACKORDER" ? Math.min(give, Math.max(0, item.quantity - 1)) : give;
        item.backordered = item.quantity - item.allocated;
        p.reserved += item.allocated;
      });
      if (items.some((i) => i.backordered > 0)) {
        o.allocationNote = `Partial allocation: ${items
          .filter((i) => i.backordered > 0)
          .map((i) => `${i.backordered} units backordered`)
          .join(", ")}.`;
      } else {
        o.allocationNote = "Full allocation completed from on-hand stock.";
      }
    });

  // downstream task records
  orders.forEach((o) => {
    const items = orderItems.filter((i) => i.orderId === o.id);
    const beyondPicking = ["PICKING", "PACKING", "QUALITY_CHECK", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED", "EXCEPTION"].includes(
      o.status,
    );
    if (!beyondPicking) return;

    const workerId = o.assignedWorkerId ?? pick(workers).id;
    items.forEach((item) => {
      const p = products.find((x) => x.id === item.productId)!;
      const isPicking = o.status === "PICKING";
      const status = isPicking ? (r() > 0.5 ? "IN_PROGRESS" : "ASSIGNED") : "COMPLETED";
      if (!isPicking) {
        item.picked = item.allocated;
      }
      pickingTasks.push({
        id: nextId("PT"),
        orderId: o.id,
        productId: p.id,
        workerId,
        quantity: item.allocated,
        pickedQuantity: isPicking ? 0 : item.allocated,
        location: p.location,
        priority: o.priority,
        status,
        startedAt: status === "ASSIGNED" ? undefined : o.stageEnteredAt,
        completedAt: status === "COMPLETED" ? o.stageEnteredAt + int(6, 15) * 60000 : undefined,
      });
    });

    const beyondPacking = ["PACKING", "QUALITY_CHECK", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED"].includes(
      o.status,
    );
    if (beyondPacking) {
      const weight =
        Math.round(
          items.reduce((s, i) => {
            const p = products.find((x) => x.id === i.productId)!;
            return s + p.weightKg * i.allocated;
          }, 0) * 10,
        ) / 10;
      const packingDone = o.status !== "PACKING";
      if (packingDone) items.forEach((i) => (i.packed = i.picked));
      packingTasks.push({
        id: nextId("PK"),
        orderId: o.id,
        status: packingDone ? "COMPLETED" : r() > 0.5 ? "IN_PROGRESS" : "WAITING",
        packaging: weight > 20 ? "Pallet + stretch wrap" : weight > 5 ? "Large corrugated box" : "Medium corrugated box",
        weightKg: weight,
        startedAt: packingDone ? o.stageEnteredAt - 20 * 60000 : undefined,
        completedAt: packingDone ? o.stageEnteredAt : undefined,
        verification: packingDone ? "Packing verification passed — picked quantities match order lines." : undefined,
      });
    }

    const beyondQc = ["QUALITY_CHECK", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED"].includes(o.status);
    if (beyondQc) {
      const passed = o.status !== "QUALITY_CHECK";
      qualityChecks.push({
        id: nextId("QC"),
        orderId: o.id,
        checklist: Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c, passed])),
        result: passed ? "PASSED" : "PENDING",
        inspector: passed ? pick(workers).name : undefined,
        checkedAt: passed ? o.stageEnteredAt : undefined,
      });
    }

    const beyondDispatch = ["READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED"].includes(o.status);
    if (beyondDispatch) {
      const pk = packingTasks.find((p) => p.orderId === o.id);
      shipments.push({
        id: nextId("SH"),
        orderId: o.id,
        courier: pick(COURIERS),
        trackingId: `TRK${int(100000, 999999)}IN`,
        weightKg: pk?.weightKg ?? 1,
        destination: o.destination,
        status: o.status === "COMPLETED" ? "DELIVERED" : o.status === "DISPATCHED" ? "IN_TRANSIT" : "READY",
        dispatchedAt: o.status === "READY_FOR_DISPATCH" ? undefined : o.stageEnteredAt,
        deliveredAt: o.status === "COMPLETED" ? o.stageEnteredAt + 8 * HOUR : undefined,
      });
    }

    // consume stock for shipped orders
    if (["DISPATCHED", "COMPLETED"].includes(o.status)) {
      items.forEach((item) => {
        const p = products.find((x) => x.id === item.productId)!;
        p.reserved = Math.max(0, p.reserved - item.allocated);
        p.quantity = Math.max(0, p.quantity - item.allocated);
        movements.push({
          id: nextId("MV"),
          productId: p.id,
          at: o.stageEnteredAt,
          delta: -item.allocated,
          reason: `Dispatched with ${o.id}`,
          actor: "System",
          balance: p.quantity,
        });
      });
      if (o.status === "COMPLETED") o.completedAt = o.stageEnteredAt + 8 * HOUR;
    }
  });

  // seeded exceptions
  const excOrders = orders.filter((o) => ["EXCEPTION", "PACKING", "PICKING", "BACKORDER"].includes(o.status));
  const excDefs: Array<[WarehouseException["type"], WarehouseException["severity"]]> = [
    ["DAMAGED_ITEM", "HIGH"],
    ["MISSING_ITEM", "CRITICAL"],
    ["STOCK_SHORTAGE", "CRITICAL"],
    ["QUALITY_FAILURE", "MEDIUM"],
    ["PACKING_ERROR", "LOW"],
    ["DISPATCH_DELAY", "MEDIUM"],
  ];
  excDefs.forEach(([type, severity], i) => {
    const o = excOrders[i % Math.max(1, excOrders.length)];
    if (!o) return;
    const item = orderItems.find((x) => x.orderId === o.id);
    const p = products.find((x) => x.id === item?.productId);
    const qty = int(1, 3);
    const replacement = p ? availableQty(p) >= qty : false;
    exceptions.push({
      id: `EXC-${2001 + i}`,
      type,
      severity,
      orderId: o.id,
      productId: p?.id,
      detectedAt: now - int(1, 26) * HOUR,
      description:
        type === "DAMAGED_ITEM"
          ? `${qty} units of ${p?.name} on ${o.id} are damaged.`
          : type === "MISSING_ITEM"
            ? `${qty} units of ${p?.name} could not be located at ${p?.location.rack}.`
            : type === "STOCK_SHORTAGE"
              ? `${o.id} requires more ${p?.name} than currently available.`
              : type === "QUALITY_FAILURE"
                ? `Quality check failed for ${o.id} — packaging integrity issue.`
                : type === "PACKING_ERROR"
                  ? `Packing quantity mismatch detected on ${o.id}.`
                  : `${o.id} missed its dispatch window.`,
      analysis: replacement
        ? `Inventory check: ${availableQty(p!)} replacement units of ${p?.name} available in ${p?.location.aisle}.`
        : `Inventory check: no replacement stock available for ${p?.name ?? "affected item"}.`,
      decision: replacement
        ? "Replace affected units from available inventory and re-run the affected stage."
        : "Create backorder for the shortfall and notify the manager for supplier escalation.",
      recommendedAction: replacement
        ? `Allocate ${qty} replacement units and resume fulfilment for ${o.id}.`
        : `Raise a reorder request with the supplier and hold ${o.id} in backorder.`,
      status: i < 4 ? "OPEN" : "RESOLVED",
      resolvedAt: i >= 4 ? now - int(1, 5) * HOUR : undefined,
      resolution: i >= 4 ? "Resolved — affected units replaced and stage re-run." : undefined,
    });
  });

  // activity log
  const acts: ActivityLog[] = [];
  orders.slice(0, 24).forEach((o, i) => {
    acts.push({
      id: nextId("AL"),
      at: o.createdAt,
      actor: "System",
      kind: "order",
      message: `${o.id} created for ${customers.find((c) => c.id === o.customerId)?.name} — ${orderItems.filter((x) => x.orderId === o.id).length} line items, ${orderValue(orderItems.filter((x) => x.orderId === o.id), products).toFixed(0)} USD`,
    });
    acts.push({
      id: nextId("AL"),
      at: o.createdAt + 4 * 60000,
      actor: "Prioritization engine",
      kind: "order",
      message: `${o.id} prioritized as ${o.priority} (score ${o.priorityScore})`,
    });
    if (i % 3 === 0 && o.assignedWorkerId) {
      acts.push({
        id: nextId("AL"),
        at: o.stageEnteredAt,
        actor: users.find((u) => u.id === o.assignedWorkerId)?.name ?? "Worker",
        kind: "picking",
        message: `Started picking tasks for ${o.id}`,
      });
    }
  });
  shipments
    .filter((s) => s.dispatchedAt)
    .forEach((s) =>
      acts.push({
        id: nextId("AL"),
        at: s.dispatchedAt!,
        actor: "Karan Iyer",
        kind: "dispatch",
        message: `${s.orderId} dispatched via ${s.courier} — tracking ${s.trackingId}`,
      }),
    );
  activity.push(...acts.sort((a, b) => b.at - a.at));

  // notifications
  const lowStock = products.filter((p) => {
    const lead = SUPPLIERS.find((s) => s.id === p.supplierId)?.leadTimeDays ?? 3;
    const rp = p.avgDailyDemand * lead + p.safetyStock;
    return availableQty(p) <= rp;
  });
  lowStock.slice(0, 6).forEach((p, i) =>
    notifications.push({
      id: `N-${100 + i}`,
      title: availableQty(p) === 0 ? "Out of stock" : "Low stock",
      message: `${p.name} (${p.sku}) has ${availableQty(p)} available units.`,
      severity: availableQty(p) === 0 ? "CRITICAL" : "MEDIUM",
      createdAt: now - int(1, 20) * HOUR,
      read: false,
      link: "/inventory",
    }),
  );
  exceptions
    .filter((e) => e.status === "OPEN")
    .forEach((e, i) =>
      notifications.push({
        id: `N-${200 + i}`,
        title: e.type.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
        message: e.description,
        severity: e.severity,
        createdAt: e.detectedAt,
        read: false,
        link: "/exceptions",
      }),
    );
  orders
    .filter((o) => o.priority === "CRITICAL" && !["COMPLETED", "DISPATCHED"].includes(o.status))
    .slice(0, 4)
    .forEach((o, i) =>
      notifications.push({
        id: `N-${300 + i}`,
        title: "Urgent order",
        message: `${o.id} is CRITICAL priority with deadline ${new Date(o.deadline).toISOString().slice(11, 16)} UTC.`,
        severity: "HIGH",
        createdAt: now - int(1, 8) * HOUR,
        read: i > 1,
        link: "/orders",
      }),
    );

  // history movements for chart depth
  products.forEach((p, i) => {
    for (let d = 6; d >= 1; d--) {
      if ((i + d) % 3 !== 0) continue;
      movements.push({
        id: nextId("MV"),
        productId: p.id,
        at: now - d * DAY,
        delta: int(-14, 30),
        reason: d % 2 === 0 ? "Supplier receipt" : "Cycle count adjustment",
        actor: "Meera Sharma",
        balance: p.quantity,
      });
    }
  });

  return {
    suppliers: SUPPLIERS,
    categories: CATEGORIES,
    products,
    movements: movements.sort((a, b) => b.at - a.at),
    customers,
    users,
    orders,
    orderItems,
    pickingTasks,
    packingTasks,
    qualityChecks,
    exceptions,
    shipments,
    notifications: notifications.sort((a, b) => b.createdAt - a.createdAt),
    reorders: [],
    activity,
    clock: now,
  };
}

export const DEMO_ORDER_IDS = ["ORD-5001", "ORD-5002"];
export { COURIERS };
