# Zaraz Tracking Setup — ULEM RTS Landing Page

Conversion tracking stack for `msimbo.org`. One browser event via `zaraz.track()` fans out to Meta Pixel + Meta CAPI, Google Ads, and GA4.

Pixel ID (Meta): `1326157149330078`

---

## Architecture

```
zaraz.track('CompleteRegistration', { email, phone, name, zip, utm_* })
        │
        ├─► Meta Pixel (browser) ──► Meta Ads
        ├─► Meta CAPI (server)   ──► Meta Ads (better match quality)
        ├─► Google Ads conversion ──► Google Ads
        └─► GA4 event 'application_submit' ──► GA4 (+ imported to Google Ads)
```

No code changes needed when adding new destinations — only Zaraz config.

---

## Event map

| User action | Zaraz trigger | Meta event | Google Ads | GA4 event |
|---|---|---|---|---|
| Any page load | (automatic) | `PageView` | — | `page_view` |
| Focus on form | `zaraz_InitiateCheckout` | `InitiateCheckout` | — | `form_start` |
| Info-session submit → `/thank-you-info-session.html` | `zaraz_Lead` | `Lead` | Info session conversion | `info_session_signup` |
| Application submit → `/thank-you-application.html` | `zaraz_CompleteRegistration` | `CompleteRegistration` | Application conversion (primary) | `application_submit` |

Code that fires these lives in `public/app.js` and the two thank-you pages.

---

## Already done

- [x] Meta Pixel tool added in Zaraz
- [x] Triggers: `zaraz_InitiateCheckout`, `zaraz_Lead`, `zaraz_CompleteRegistration`
- [x] Custom actions on Meta Pixel tool: `FB - InitiateCheckout`, `FB - Lead`, `FB - CompleteRegistration`
- [x] GTM removed from all pages
- [x] `zaraz.track()` calls wired into `app.js` and thank-you pages
- [x] Primary Meta conversion event confirmed: **`CompleteRegistration`**

---

## TODO: Google Ads setup

### 1. Create conversion actions in Google Ads

Google Ads → Tools → **Conversions** → **+ New conversion action** → **Website**.

**Conversion 1 — Application (primary)**
- Category: **Submit lead form**
- Name: `Application Submitted`
- Value: Don't use a value (or set $50 proxy)
- Count: **One** (per application, not every)
- Click-through window: 30 days
- Save, then copy the **Conversion ID** (`AW-XXXXXXXXX`) and **Conversion Label** (`AbC-D_efG...`)

**Conversion 2 — Info session (secondary)**
- Category: **Sign-up**
- Name: `Info Session Signup`
- Same settings; copy the Conversion Label

### 2. Add Google Ads tool in Zaraz

Zaraz → Third-party tools → Add new tool → **Google Ads Conversion Tracking**.

Enter the **Conversion ID** (`AW-XXXXXXXXX`). Save.

### 3. Create custom actions on the Google Ads tool

**Action: `GAds - Application`**
- Firing Trigger: `zaraz_CompleteRegistration`
- Action Type: Conversion Event
- Conversion Label: (from Application Submitted action)
- Include Event Properties: ON

**Action: `GAds - InfoSession`**
- Firing Trigger: `zaraz_Lead`
- Conversion Label: (from Info Session Signup action)
- Include Event Properties: ON

### 4. Turn on Enhanced Conversions

Google Ads → Conversions → `Application Submitted` → **Enhanced conversions** tab → toggle on → method: **Google tag**.

In Zaraz's Google Ads tool settings → Enhanced Conversions / User Data section → map:
- `email` → email
- `phone` → phone_number
- `first_name` → first_name
- `last_name` → last_name
- `zip_code` → postal_code

(Zaraz hashes these automatically before sending.)

### 5. Google Ads campaign setup

- Campaign goal: **Leads**
- Primary conversion: `Application Submitted`
- Secondary conversion: `Info Session Signup`

---

## TODO: GA4 setup

### 1. Prep GA4

- analytics.google.com → Admin → **Data streams** → Web → add stream for `msimbo.org` if needed
- Copy the **Measurement ID** (`G-XXXXXXXXXX`)

### 2. Add GA4 tool in Zaraz

Zaraz → Third-party tools → Add new tool → **Google Analytics 4**.

Paste the Measurement ID. Save.

Leave the automated **Pageview** action enabled — it'll send `page_view` on every load with UTM params automatically.

### 3. Create GA4 custom actions

**`GA4 - Application`**
- Trigger: `zaraz_CompleteRegistration`
- Event Name: `application_submit`
- Include Event Properties: ON

**`GA4 - InfoSession`**
- Trigger: `zaraz_Lead`
- Event Name: `info_session_signup`
- Include Event Properties: ON

**`GA4 - FormStart`**
- Trigger: `zaraz_InitiateCheckout`
- Event Name: `form_start`
- Include Event Properties: ON

**`GA4 - FAQ`** (optional)
- Create new trigger `zaraz_faq_expanded` first (event name equals `faq_expanded`)
- Event Name: `faq_expand`
- Include Event Properties: ON

### 4. Mark conversions in GA4 (after events start flowing)

Wait ~24 hours, then GA4 → Admin → **Events** (or **Key events**):
- Toggle `application_submit` → Mark as key event
- Toggle `info_session_signup` → Mark as key event

---

## Don't forget

**Publish Zaraz** after every config change. Top-right of the Zaraz dashboard — nothing goes live until published.

---

## Verification

### Meta
- Meta Pixel Helper Chrome extension → visit site → should see PageView / InitiateCheckout / Lead / CompleteRegistration
- Meta Events Manager → your Pixel → **Test Events** tab → submit a real form → confirm server-side event arrives with matched user data
- Event Match Quality should climb to 6-8/10 over a day

### Google Ads
- Google Tag Assistant Chrome extension on thank-you pages → should see `AW-XXX` conversion firing
- Google Ads → Conversions → status column: "Recording conversions" within a few hours
- Enhanced Conversions diagnostics tab → shows match rate

### GA4
- GA4 → Reports → **Realtime** → visit site → see yourself within 30s
- Submit form → see `application_submit` event in realtime
- Optional: enable debug mode, watch GA4 → Admin → **DebugView**

---

## Notes

- `www.msimbo.org` DNS record needs to be orange-clouded if users ever reach it directly. Check: `curl -sI https://www.msimbo.org | grep -iE "server|cf-ray"` — should show `cf-ray` header.
- Zaraz doesn't inject its script for plain `curl` requests (User-Agent filter). Verify in a real browser's Network tab — look for `/cdn-cgi/zaraz/` requests.
- `typeof window.zaraz` in browser console should return `"object"`.
