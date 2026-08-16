import { createFileRoute } from "@tanstack/react-router";
import { History, Plus, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

import { RoleGate } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryBadge, Pill } from "@/components/wms/badges";
import { DataRow, EmptyState, KpiCard, PageHeader, SectionCard } from "@/components/wms/bits";
import {
  availableQty,
  fmtDateTime,
  kpis,
  leadTimeFor,
  money,
  productStatus,
  recommendedReorderQty,
  reorderPoint,
} from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import type { Product } from "@/lib/wms/types";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Management — SmartFlow WMS" },
      {
        name: "description",
        content:
          "Live stock ledger with reserved vs available quantities, reorder points, damaged stock and full stock adjustment history.",
      },
      { property: "og:title", content: "Inventory Management — SmartFlow WMS" },
      { property: "og:description", content: "Reserved vs available stock, reorder points and adjustment history." },
    ],
  }),
  component: () => (
    <RoleGate allow={["manager", "worker"]}>
      <InventoryPage />
    </RoleGate>
  ),
});

const PAGE_SIZE = 12;

function InventoryPage() {
  const { state, saveProduct, adjustStock, createReorder, role } = useWms();
  const k = kpis(state);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("risk");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Product | null>(null);
  const [adjustFor, setAdjustFor] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => {
    const list = state.products
      .map((p) => ({ p, status: productStatus(state, p), available: availableQty(p) }))
      .filter((r) => (status === "ALL" ? true : r.status === status))
      .filter((r) => (category === "ALL" ? true : r.p.categoryId === category))
      .filter((r) => (q.trim() ? `${r.p.name} ${r.p.sku}`.toLowerCase().includes(q.toLowerCase()) : true));
    return list.sort((a, b) => {
      if (sort === "risk") return a.available - b.available;
      if (sort === "name") return a.p.name.localeCompare(b.p.name);
      if (sort === "value") return b.p.quantity * b.p.unitPrice - a.p.quantity * a.p.unitPrice;
      return b.p.lastUpdated - a.p.lastUpdated;
    });
  }, [state, q, status, category, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Inventory Management"
        subtitle="Available stock = total stock − reserved − damaged. Low-stock and out-of-stock alerts are computed live."
        actions={
          role === "manager" && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="size-4" /> Add product</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add product</DialogTitle>
                  <DialogDescription>New SKUs enter the catalogue with zero reserved stock.</DialogDescription>
                </DialogHeader>
                <ProductForm
                  onSubmit={(payload) => {
                    saveProduct(payload);
                    setAddOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="SKUs tracked" value={state.products.length} hint={`${state.categories.length} categories`} />
        <KpiCard label="Low stock" value={k.lowStock} tone="warning" hint="At or below reorder point" />
        <KpiCard label="Out of stock" value={k.outOfStock} tone="danger" />
        <KpiCard label="Inventory value" value={money(k.inventoryValue)} tone="success" />
      </div>

      <SectionCard className="mt-4" title={`Stock ledger (${rows.length})`} bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search product or SKU" className="pl-8" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-42"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "RESERVED", "DAMAGED"].map((s) => (
                <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {state.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="risk">Sort: lowest available</SelectItem>
              <SelectItem value="name">Sort: name</SelectItem>
              <SelectItem value="value">Sort: stock value</SelectItem>
              <SelectItem value="updated">Sort: last updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <div className="p-4"><EmptyState title="No products match" description="Adjust the filters to see stock." /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder pt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(({ p, status: st, available }) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.sku} · {money(p.unitPrice)}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.location.aisle} / {p.location.rack} / {p.location.shelf}
                    </TableCell>
                    <TableCell className="tabular text-right">{p.quantity}</TableCell>
                    <TableCell className="tabular text-right">{p.reserved}</TableCell>
                    <TableCell className="tabular text-right font-semibold">{available}</TableCell>
                    <TableCell className="tabular text-right">{reorderPoint(p, leadTimeFor(state, p))}</TableCell>
                    <TableCell>
                      <InventoryBadge status={st} />
                      {p.damaged > 0 && <Pill tone="accent" className="ml-1">{p.damaged} dmg</Pill>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {state.suppliers.find((s) => s.id === p.supplierId)?.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetail(p)} aria-label="Details">
                          <History className="size-4" />
                        </Button>
                        {role === "manager" && (
                          <Button variant="ghost" size="icon" onClick={() => setAdjustFor(p)} aria-label="Adjust stock">
                            <Settings2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">Page {current} of {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
          </div>
        </div>
      </SectionCard>

      {/* product detail + history */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.name}</DialogTitle>
                <DialogDescription>{detail.sku} · {state.categories.find((c) => c.id === detail.categoryId)?.name}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <DataRow label="Total stock" value={detail.quantity} />
                  <DataRow label="Reserved" value={detail.reserved} />
                  <DataRow label="Damaged" value={detail.damaged} />
                  <DataRow label="Available" value={availableQty(detail)} />
                  <DataRow label="Minimum stock" value={detail.minStock} />
                  <DataRow label="Maximum stock" value={detail.maxStock} />
                </div>
                <div>
                  <DataRow label="Avg daily demand" value={`${detail.avgDailyDemand}/day`} />
                  <DataRow label="Lead time" value={`${leadTimeFor(state, detail)} days`} />
                  <DataRow label="Safety stock" value={detail.safetyStock} />
                  <DataRow label="Reorder point" value={reorderPoint(detail, leadTimeFor(state, detail))} />
                  <DataRow label="Recommended reorder" value={`${recommendedReorderQty(detail)} units`} />
                  <DataRow label="Last updated" value={fmtDateTime(detail.lastUpdated)} />
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold">Stock history</h3>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                {state.movements.filter((m) => m.productId === detail.id).length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No movements recorded yet.</p>
                )}
                {state.movements
                  .filter((m) => m.productId === detail.id)
                  .slice(0, 20)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-0">
                      <div>
                        <p className="text-xs font-medium">{m.reason}</p>
                        <p className="text-[11px] text-muted-foreground">{m.actor} · {fmtDateTime(m.at)}</p>
                      </div>
                      <Pill tone={m.delta > 0 ? "success" : m.delta < 0 ? "danger" : "neutral"}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </Pill>
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => createReorder(detail.id)}>Create reorder request</Button>
                <Button onClick={() => { setAdjustFor(detail); setDetail(null); }}>Adjust stock</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* stock adjustment */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent>
          {adjustFor && (
            <AdjustForm
              product={adjustFor}
              onSubmit={(delta, reason) => {
                adjustStock(adjustFor.id, delta, reason);
                setAdjustFor(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdjustForm({ product, onSubmit }: { product: Product; onSubmit: (delta: number, reason: string) => void }) {
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("Cycle count adjustment");
  const parsed = Number(delta);
  const invalid = Number.isNaN(parsed) || parsed === 0 || product.quantity + parsed < product.reserved;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust stock — {product.name}</DialogTitle>
        <DialogDescription>
          Current {product.quantity} units, {product.reserved} reserved. Adjustments cannot drop below reserved stock.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label htmlFor="delta">Quantity change</Label>
          <Input id="delta" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 25 or -10" />
        </div>
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {invalid && (
          <p className="text-xs text-danger">
            {parsed === 0 || Number.isNaN(parsed)
              ? "Enter a non-zero quantity change."
              : "Resulting stock would be lower than the reserved quantity."}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button disabled={invalid} onClick={() => onSubmit(parsed, reason)}>Apply adjustment</Button>
      </DialogFooter>
    </>
  );
}

function ProductForm({ onSubmit }: { onSubmit: (p: Partial<Product> & { name: string }) => void }) {
  const { state } = useWms();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    categoryId: state.categories[0]!.id,
    supplierId: state.suppliers[0]!.id,
    unitPrice: "0",
    quantity: "0",
    avgDailyDemand: "5",
    safetyStock: "10",
    maxStock: "120",
    aisle: "A",
  });
  const valid = form.name.trim().length > 2 && Number(form.quantity) >= 0 && Number(form.unitPrice) >= 0;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="pname">Product name</Label>
          <Input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="auto" />
        </div>
        <div>
          <Label htmlFor="price">Unit price</Label>
          <Input id="price" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {state.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Supplier</Label>
          <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {state.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="qty">Opening quantity</Label>
          <Input id="qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="demand">Avg daily demand</Label>
          <Input id="demand" value={form.avgDailyDemand} onChange={(e) => setForm({ ...form, avgDailyDemand: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="safety">Safety stock</Label>
          <Input id="safety" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="max">Maximum stock</Label>
          <Input id="max" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} />
        </div>
      </div>
      {!valid && <p className="mt-2 text-xs text-danger">Enter a product name (3+ characters) and valid numeric values.</p>}
      <DialogFooter className="mt-3">
        <Button
          disabled={!valid}
          onClick={() =>
            onSubmit({
              name: form.name.trim(),
              ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
              categoryId: form.categoryId,
              supplierId: form.supplierId,
              unitPrice: Number(form.unitPrice),
              quantity: Number(form.quantity),
              avgDailyDemand: Number(form.avgDailyDemand),
              safetyStock: Number(form.safetyStock),
              minStock: Number(form.safetyStock),
              maxStock: Number(form.maxStock),
              location: { aisle: form.aisle, rack: `${form.aisle}-01`, shelf: "01" },
            })
          }
        >
          Save product
        </Button>
      </DialogFooter>
    </>
  );
}
