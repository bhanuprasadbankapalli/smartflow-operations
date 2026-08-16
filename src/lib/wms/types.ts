export type Role = "manager" | "worker" | "dispatcher";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";

export type OrderStatus =
  | "NEW"
  | "PRIORITIZED"
  | "ALLOCATED"
  | "PICKING"
  | "PACKING"
  | "QUALITY_CHECK"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "COMPLETED"
  | "BACKORDER"
  | "EXCEPTION"
  | "CANCELLED";

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "RESERVED" | "DAMAGED";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  leadTimeDays: number;
  reliability: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface WarehouseLocation {
  aisle: string;
  rack: string;
  shelf: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  supplierId: string;
  unitPrice: number;
  weightKg: number;
  quantity: number;
  reserved: number;
  damaged: number;
  minStock: number;
  maxStock: number;
  avgDailyDemand: number;
  safetyStock: number;
  location: WarehouseLocation;
  lastUpdated: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  at: number;
  delta: number;
  reason: string;
  actor: string;
  balance: number;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  vip: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  allocated: number;
  picked: number;
  packed: number;
  backordered: number;
}

export interface Order {
  id: string;
  customerId: string;
  createdAt: number;
  deadline: number;
  status: OrderStatus;
  priority: Priority;
  priorityScore: number;
  priorityReasons: string[];
  assignedWorkerId?: string | undefined;
  destination: string;
  allocationNote?: string | undefined;
  stageEnteredAt: number;
  stageDurations: Partial<Record<OrderStatus, number>>;
  completedAt?: number | undefined;
}

export type PickingStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "MISSING" | "DAMAGED";

export interface PickingTask {
  id: string;
  orderId: string;
  productId: string;
  workerId: string;
  quantity: number;
  pickedQuantity: number;
  location: WarehouseLocation;
  priority: Priority;
  status: PickingStatus;
  startedAt?: number | undefined;
  completedAt?: number | undefined;
}

export type PackingStatus = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export interface PackingTask {
  id: string;
  orderId: string;
  status: PackingStatus;
  packaging: string;
  weightKg: number;
  startedAt?: number | undefined;
  completedAt?: number | undefined;
  verification?: string | undefined;
}

export interface QualityCheck {
  id: string;
  orderId: string;
  checklist: Record<string, boolean>;
  result: "PENDING" | "PASSED" | "FAILED";
  inspector?: string | undefined;
  note?: string | undefined;
  checkedAt?: number | undefined;
}

export type ExceptionType =
  | "MISSING_ITEM"
  | "DAMAGED_ITEM"
  | "STOCK_SHORTAGE"
  | "WRONG_ITEM"
  | "PACKING_ERROR"
  | "QUALITY_FAILURE"
  | "DISPATCH_DELAY";

export interface WarehouseException {
  id: string;
  type: ExceptionType;
  severity: Severity;
  orderId?: string | undefined;
  productId?: string | undefined;
  detectedAt: number;
  description: string;
  analysis: string;
  decision: string;
  recommendedAction: string;
  status: "OPEN" | "ANALYZED" | "RESOLVED";
  resolvedAt?: number | undefined;
  resolution?: string | undefined;
}

export type ShipmentStatus = "READY" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED";

export interface Shipment {
  id: string;
  orderId: string;
  courier: string;
  trackingId: string;
  weightKg: number;
  destination: string;
  status: ShipmentStatus;
  dispatchedAt?: number | undefined;
  deliveredAt?: number | undefined;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  createdAt: number;
  read: boolean;
  link?: string | undefined;
}

export interface ReorderRequest {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  status: "RECOMMENDED" | "APPROVED" | "REJECTED" | "ORDERED";
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  at: number;
  actor: string;
  message: string;
  kind: "order" | "inventory" | "picking" | "packing" | "quality" | "dispatch" | "exception" | "system";
}

export interface User {
  id: string;
  name: string;
  role: Role;
  shift: string;
  activeTasks: number;
}

export interface WmsState {
  suppliers: Supplier[];
  categories: Category[];
  products: Product[];
  movements: StockMovement[];
  customers: Customer[];
  users: User[];
  orders: Order[];
  orderItems: OrderItem[];
  pickingTasks: PickingTask[];
  packingTasks: PackingTask[];
  qualityChecks: QualityCheck[];
  exceptions: WarehouseException[];
  shipments: Shipment[];
  notifications: Notification[];
  reorders: ReorderRequest[];
  activity: ActivityLog[];
  clock: number;
}
