import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: ProductsPage,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("19");

  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, tagline, is_active, base_currency, base_price_minor, product_prices(currency, price_minor)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
          base_currency: "USD",
          base_price_minor: Math.round(Number(price) * 100),
          is_active: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setOpen(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      navigate({ to: "/admin/products/$id", params: { id: data.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each product gets its own checkout page and per-country pricing.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> New product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-price">Base price (USD)</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={name.trim().length < 2 || create.isPending}
              >
                Create and edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(products.data ?? []).map((product) => (
          <Link
            key={product.id}
            to="/admin/products/$id"
            params={{ id: product.id }}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display font-semibold">{product.name}</h2>
              <Badge variant={product.is_active ? "default" : "secondary"}>
                {product.is_active ? "Live" : "Draft"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">/p/{product.slug}</p>
            <p className="tabular mt-4 text-sm text-primary">
              Base {formatMoney(Number(product.base_price_minor), product.base_currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(product.product_prices ?? []).length} currency override
              {(product.product_prices ?? []).length === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
        {products.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products yet. Create your first one.</p>
        ) : null}
      </div>
    </div>
  );
}
