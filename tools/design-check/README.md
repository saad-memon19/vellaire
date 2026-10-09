# Design check

Developer tools to verify the built app against the designs in `/design`. Not part of the product.

```bash
cd tools/design-check
npm install && npx playwright install chromium
# with `npm run dev` running at the repo root:

# 1. Design vs built, side by side (writes NAME_d.png, NAME_b.png)
node dcshot.mjs ../../design ./out sara.khan@meridian.com "Approvals.dc.html=/app/approvals"
#    email "-" = no sign-in (public pages). Phone artboards (390 wide) are captured at phone size.
node pair.mjs ./out 1440 Approvals        # -> out/Approvals_pair.png (use 390 for phone screens)

# 2. Open every route as each role and list console errors, failed requests and crashes
node crawl.mjs
```

Sign-in works through the development magic link, so no email service is needed.
