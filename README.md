# Vendora

Build a reusable multi-product digital checkout platform with an admin dashboard (product management with per-country currency pricing overrides for NGN, GHS, KES, USD; order & customer management; revenue breakdown by original currency; payment gateway & tracking settings) and localized public checkout pages with Paystack and Flutterwave smart routing, Meta Pixel and Conversions API attribution continuity (preserving fbclid, _fbp, _fbc, and UTMs), and post-payment digital fulfillment via hosted download and email access.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://checkout-charm-32.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ea9fce9c-df13-4612-ab48-524f960c41fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Embed on any sales page

Load the helper on the sales page, then use the same product checkout URL for a redirect or drawer. It carries the original `fbclid`, `_fbp`, `_fbc`, and UTM parameters into the checkout even when the sales page and checkout use different domains.

```html
<script src="https://YOUR-CHECKOUT-DOMAIN/checkout-charm.js" defer></script>
<button onclick="CheckoutCharm.openDrawer('https://YOUR-CHECKOUT-DOMAIN/p/sample-ebook')">
  Buy now
</button>
<!-- Or: CheckoutCharm.redirect('https://YOUR-CHECKOUT-DOMAIN/p/sample-ebook') -->
```

Use the **same Meta Pixel ID** on the sales page and in Vendora. Browser Purchase and server-side Conversions API Purchase share one event ID, so Meta can deduplicate them. Set `META_CAPI_ACCESS_TOKEN` only as a server environment variable; never expose it in the sales-page script.
# Vendora

## Production payment maintenance

Set `VENDORA_CRON_SECRET` in the deployment environment and schedule a `POST`
every five minutes to `/api/internal/payment-maintenance` with:

```text
Authorization: Bearer <VENDORA_CRON_SECRET>
```

The endpoint durably processes due Meta CAPI Purchase retries and expires
pending payment sessions older than 24 hours. It is safe to invoke more than
once because state transitions and retry records are database-backed.
