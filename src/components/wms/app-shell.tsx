import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bell,
  BarChart3,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { fmtDateTime, kpis } from "@/lib/wms/engine";
import { useWms } from "@/lib/wms/store";
import type { Role } from "@/lib/wms/types";
import { Pill, SeverityBadge } from "./badges";
import { LoginScreen } from "./login-screen";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  group: string;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["manager", "worker", "dispatcher"], group: "Overview" },
  { to: "/smart-decisions", label: "Smart Decisions", icon: Sparkles, roles: ["manager"], group: "Overview" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["manager"], group: "Overview" },
  { to: "/orders", label: "Orders", icon: PackageSearch, roles: ["manager", "dispatcher"], group: "Fulfilment" },
  { to: "/picking", label: "Picking", icon: Boxes, roles: ["manager", "worker"], group: "Fulfilment" },
  { to: "/packing", label: "Packing", icon: PackageCheck, roles: ["manager", "worker"], group: "Fulfilment" },
  { to: "/quality", label: "Quality Check", icon: ShieldCheck, roles: ["manager", "dispatcher"], group: "Fulfilment" },
  { to: "/dispatch", label: "Dispatch", icon: Truck, roles: ["manager", "dispatcher"], group: "Fulfilment" },
  { to: "/inventory", label: "Inventory", icon: Warehouse, roles: ["manager", "worker"], group: "Inventory" },
  { to: "/reorder", label: "Reorder Engine", icon: ClipboardCheck, roles: ["manager"], group: "Inventory" },
  { to: "/exceptions", label: "Exceptions", icon: AlertTriangle, roles: ["manager", "worker", "dispatcher"], group: "Control" },
  { to: "/activity", label: "Activity Log", icon: Activity, roles: ["manager", "dispatcher"], group: "Control" },
];

const ROLE_LABEL: Record<Role, string> = {
  manager: "Warehouse Manager",
  worker: "Warehouse Worker",
  dispatcher: "Dispatcher",
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useWms();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => n.roles.includes(role));
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group}>
          <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/45">
            {group}
          </p>
          <div className="flex flex-col gap-0.5">
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active && "bg-sidebar-primary/15 text-sidebar-primary",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
        <Warehouse className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-bold tracking-tight text-sidebar-accent-foreground">SmartFlow WMS</p>
        <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Operations Control</p>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { state, markNotificationRead, markAllNotificationsRead } = useWms();
  const unread = state.notifications.filter((n) => !n.read);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {unread.length > 0 && (
            <span className="tabular absolute -right-1.5 -top-1.5 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-90 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notification centre</p>
          <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} disabled={!unread.length}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="h-80">
          {state.notifications.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">No notifications.</p>
          )}
          {state.notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={cn(
                "flex w-full flex-col items-start gap-1 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                !n.read && "bg-info-soft/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-semibold">{n.title}</span>
                <SeverityBadge severity={n.severity} />
              </div>
              <span className="text-xs text-muted-foreground">{n.message}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {fmtDateTime(n.createdAt)}
              </span>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, setRole, actor, state, runDemoScenario, resetDemo, signedIn, signOut } = useWms();
  const [open, setOpen] = useState(false);
  const k = kpis(state);

  if (!signedIn) return <LoginScreen />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar lg:flex">
        <Brand />
        <NavList />
        <div className="mt-auto border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">Open exceptions</p>
            <p className="tabular text-lg font-bold text-sidebar-accent-foreground">{k.openExceptions}</p>
            <p className="mt-1 text-[11px] text-sidebar-foreground/60">
              {k.delayed} delayed · {k.outOfStock} out of stock
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/90 px-3 py-2.5 backdrop-blur sm:px-5">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-68 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="mr-auto hidden min-w-0 items-center gap-2 md:flex">
            <Pill tone="success" dot>
              Live
            </Pill>
            <span className="truncate text-xs text-muted-foreground">
              Operating window {fmtDateTime(state.clock)} UTC · {k.total} orders in scope
            </span>
          </div>

          <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={runDemoScenario}>
            <Sparkles className="size-4" />
            Run Smart Decision Demo
          </Button>
          <Button variant="ghost" size="icon" onClick={resetDemo} aria-label="Reset demo data">
            <RotateCcw className="size-4" />
          </Button>
          <NotificationBell />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-38 sm:w-52" aria-label="Switch role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="hidden text-right leading-tight xl:block">
            <p className="text-xs font-semibold">{actor}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{ROLE_LABEL[role]}</p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            Logout
          </Button>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 sm:px-5 lg:px-7">{children}</main>
      </div>
    </div>
  );
}

export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { role } = useWms();
  if (allow.includes(role)) return <>{children}</>;
  return (
    <div className="panel mx-auto max-w-md p-8 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-warning-soft text-warning-foreground">
        <ShieldCheck className="size-5" />
      </span>
      <h2 className="mt-3 text-base font-semibold">Restricted for your role</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {ROLE_LABEL[role]} accounts don't have access to this module. Switch role in the top bar to continue.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
