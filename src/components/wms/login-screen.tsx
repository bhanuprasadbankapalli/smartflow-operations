import { Warehouse } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWms } from "@/lib/wms/store";
import type { Role } from "@/lib/wms/types";

const ROLE_LABEL: Record<Role, string> = {
  manager: "Warehouse Manager",
  worker: "Warehouse Worker",
  dispatcher: "Dispatcher",
};

export function LoginScreen() {
  const { signIn, role } = useWms();
  const [selected, setSelected] = useState<Role>(role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel w-full max-w-sm p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Warehouse className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-tight">SmartFlow WMS</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Operations Control</p>
          </div>
        </div>

        <h1 className="mt-5 text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a role and continue. No password required.</p>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <Select value={selected} onValueChange={(v) => setSelected(v as Role)}>
            <SelectTrigger aria-label="Select role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="mt-5 w-full" onClick={() => signIn(selected)}>
          Login
        </Button>
      </div>
    </div>
  );
}
