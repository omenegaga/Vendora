import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: ProductEditor,
});

type Draft = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  cover_image_url: string;
  base_currency: string;
  base_price: string;
  file_url: string;
  file_name: string;
  file_path: string | null;
  is_active: boolean;
};

function ProductEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const product = useQuery({
    queryKey: ["admin-product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_prices(currency, price_minor)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const data = product.data;
    if (!data) return;
    setDraft({
      name: data.name,
      slug: data.slug,
      tagline: data.tagline ?? "",
      description: data.description ?? "",
      cover_image_url: data.cover_image_url ?? "",
      base_currency: data.base_currency,
      base_price: (Number(data.base_price_minor) / 100).toString(),
      file_url: data.file_url ?? "",
      file_name: data.file_name ?? "",
      file_path: data.file_path,
      is_active: data.is_active,
    });
    const next: Record<string, string> = {};
    for (const row of data.product_prices ?? []) {
      next[row.currency] = (Number(row.price_minor) / 100).toString();
    }
    setPrices(next);
  }, [product.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { error } = await supabase
        .from("products")
        .update({
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          tagline: draft.tagline.trim() || null,
          description: draft.description.trim() || null,
          cover_image_url: draft.cover_image_url.trim() || null,
          base_currency: draft.base_currency,
          base_price_minor: Math.round(Number(draft.base_price || 0) * 100),
          file_url: draft.file_url.trim() || null,
          file_name: draft.file_name.trim() || null,
          file_path: draft.file_path,
          is_active: draft.is_active,
        })
        .eq("id", id);
      if (error) throw error;

      for (const currency of SUPPORTED_CURRENCIES) {
        const raw = prices[currency];
        const value = raw ? Math.round(Number(raw) * 100) : 0;
        if (!raw || value <= 0) {
          await supabase.from("product_prices").delete().eq("product_id", id).eq("currency", currency);
        } else {
          await supabase
            .from("product_prices")
            .upsert({ product_id: id, currency, price_minor: value }, { onConflict: "product_id,currency" });
        }
      }
    },
    onSuccess: () => {
      toast.success("Product saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      navigate({ to: "/admin/products" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("product-files").upload(path, file, {
        upsert: true,
      });
      if (error) throw error;
      setDraft((current) =>
        current ? { ...current, file_path: path, file_name: file.name, file_url: "" } : current,
      );
      toast.success("File uploaded. Remember to save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploadingCover(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      setDraft((current) =>
        current ? { ...current, cover_image_url: `/api/public/product-image/${path}` } : current,
      );
      toast.success("Cover image uploaded. Remember to save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  if (!draft) return <p className="text-sm text-muted-foreground">Loading product…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All products
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Live</span>
          <Switch
            checked={draft.is_active}
            onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })}
          />
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Checkout link</Label>
            <Input id="slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            <p className="text-xs text-muted-foreground">/p/{draft.slug}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={draft.tagline}
            onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={5}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="space-y-3">
          <Label>Cover image</Label>
          {draft.cover_image_url ? (
            <img
              src={draft.cover_image_url}
              alt={`${draft.name} cover`}
              className="h-40 w-full max-w-xs rounded-lg border border-border object-cover"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm">
              <Upload className="size-4" />
              {uploadingCover ? "Uploading…" : "Upload from device"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                }}
              />
            </label>
            {draft.cover_image_url ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ ...draft, cover_image_url: "" })}
              >
                Remove image
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover">…or paste an image link</Label>
            <Input
              id="cover"
              placeholder="https://..."
              value={draft.cover_image_url}
              onChange={(e) => setDraft({ ...draft, cover_image_url: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="base-price">Base price</Label>
            <Input
              id="base-price"
              type="number"
              min="0"
              step="0.01"
              value={draft.base_price}
              onChange={(e) => setDraft({ ...draft, base_price: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="base-currency">Base currency</Label>
            <select
              id="base-currency"
              value={draft.base_currency}
              onChange={(e) => setDraft({ ...draft, base_currency: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm"
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Set an exact local price per currency. Leave one empty to convert automatically from the
          base price using the rates in Settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <div key={currency} className="space-y-2">
              <Label htmlFor={`price-${currency}`}>
                {currency} — {CURRENCY_LABELS[currency]}
              </Label>
              <Input
                id={`price-${currency}`}
                type="number"
                min="0"
                step="0.01"
                placeholder="auto"
                value={prices[currency] ?? ""}
                onChange={(e) => setPrices({ ...prices, [currency]: e.target.value })}
              />
              {prices[currency] ? (
                <p className="tabular text-xs text-muted-foreground">
                  {formatMoney(Math.round(Number(prices[currency]) * 100), currency)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Digital file</h2>
        {draft.file_path ? (
          <p className="text-sm text-muted-foreground">
            Hosted file: <span className="text-foreground">{draft.file_name || draft.file_path}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm">
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "Upload file"}
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {draft.file_path ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft({ ...draft, file_path: null, file_name: "" })}
            >
              Remove hosted file
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="file-url">…or link to a file hosted elsewhere</Label>
          <Input
            id="file-url"
            placeholder="https://..."
            value={draft.file_url}
            onChange={(e) => setDraft({ ...draft, file_url: e.target.value, file_path: null })}
          />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Save product
        </Button>
        <Button variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
          <Trash2 className="mr-2 size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}
