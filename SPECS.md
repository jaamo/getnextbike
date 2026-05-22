# GetNextBike — Specification

A backend service that aggregates bicycle catalog data (brands, models, components) and tracks reseller inventory (price, stock) across regions. API-first with admin views. Crawler is self-healing using AI to regenerate broken selectors.

---

## 1. Goals & Non-Goals

### Goals
- Authoritative catalog of bicycle brands, models, model years and components.
- Reseller inventory with current and historical price + stock status.
- Multi-region support (currency, language, availability differ per region).
- Public read-only API for catalog and inventory data.
- Admin UI for catalog curation, reseller management, and crawler operations.
- Resilient crawler: auto-detects broken selectors, asks an LLM to regenerate them, escalates to a human when AI fails.

### Non-Goals (initial release)
- End-user purchase flow / cart / checkout.
- Affiliate tracking, conversion analytics.
- Bike reviews / user-generated content.
- Search relevance tuning beyond basic filters (defer to a search index later).

---

## 2. Domain Model

### 2.1 Entities (high-level)

```
Brand ───< Model ───< ModelYear ───< ModelVariant >── Region (nullable)
                                          │
                                          └──< ModelVariantComponent >── Component

Region ──< Reseller ──< InventoryItem >── ModelVariant
                            │
                            ├──< PriceObservation
                            ├──< StockObservation
                            └──< CrawlSelector ──< CrawlSelectorVersion
                                       │
                                       └──< CrawlRun ──< CrawlFieldResult
```

A variant is region-scoped: `region_id` can be null (global build) or a specific region (region-specific build with its own components, SKU, and notes).

### 2.2 Tables

#### `brands`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| slug | text unique | URL-safe; e.g. `trek`, `canyon` |
| name | text | |
| country_code | text nullable | ISO 3166-1 alpha-2 |
| website_url | text nullable | |
| description | text nullable | |
| created_at / updated_at | timestamptz | |

#### `models`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| brand_id | uuid FK → brands | |
| slug | text | unique per brand |
| name | text | e.g. `Domane SLR` |
| category | enum | `road`, `gravel`, `mtb_xc`, `mtb_trail`, `mtb_enduro`, `mtb_dh`, `hybrid`, `commuter`, `city`, `cargo`, `kids`, `bmx`, `ebike_road`, `ebike_mtb`, `ebike_city`, … (TBD finalized list) |
| discipline_tags | text[] | secondary tags |
| description | text nullable | |
| created_at / updated_at | timestamptz | |

UNIQUE(brand_id, slug).

#### `model_years`
A specific year's release of a model. Holds year-level marketing data and base MSRP.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| model_id | uuid FK → models | |
| year | int | e.g. 2026 |
| msrp_amount | numeric(10,2) nullable | reference MSRP — region-specific prices live on `model_year_region_prices` |
| msrp_currency | text nullable | ISO 4217, denormalized for convenience |
| hero_image_url | text nullable | |
| spec_sheet_url | text nullable | |
| created_at / updated_at | timestamptz | |

UNIQUE(model_id, year).

#### `model_variants`
Build kits / colors / sizes within a model year. Each variant is what a reseller actually stocks.

A variant is **scoped to a region** (or global). Manufacturers commonly ship region-specific builds — e.g. a 2026 Trek Domane SLR 7 in EU may run Ultegra Di2 while the US build uses SRAM Force AXS, and EU ebikes are speed-limited to 25 km/h vs 32 km/h in US. Region-specific variants let each build carry its own component list, SKU, and weight without override-resolution logic.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| model_year_id | uuid FK → model_years | |
| region_id | uuid FK → regions, nullable | `null` = global build sold everywhere; non-null = region-specific build |
| sku | text nullable | manufacturer SKU (often region-specific itself) |
| build_name | text nullable | e.g. `SLR 7 AXS` |
| frame_size | text nullable | `S`, `M`, `54cm`, etc. |
| color | text nullable | |
| weight_grams | int nullable | |
| notes | text nullable | free-form, e.g. `EU 25 km/h motor` |
| created_at / updated_at | timestamptz | |

UNIQUE(model_year_id, region_id, build_name, frame_size, color) — nullable-safe via partial indexes if needed.

Resolution rule when matching a reseller's inventory to a variant for a given region `R`:
1. Prefer the variant with `region_id = R`.
2. Fall back to the variant with `region_id IS NULL` (global build).
3. If neither exists, the inventory item stays in `needs_review`.

#### `regions`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| code | text unique | e.g. `EU`, `US`, `FI`, `NORDICS` — region granularity is policy, not geo. |
| name | text | |
| default_currency | text | ISO 4217 |
| countries | text[] | ISO 3166-1 alpha-2 list |

#### `model_year_region_availability`
A model year may exist in some regions and not others; MSRP differs.

| column | type | notes |
| --- | --- | --- |
| model_year_id | uuid FK | |
| region_id | uuid FK | |
| msrp_amount | numeric(10,2) nullable | |
| msrp_currency | text nullable | |
| available | bool default true | |

PRIMARY KEY(model_year_id, region_id).

#### `components`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| type | enum | `groupset`, `drivetrain`, `brakes`, `wheels`, `tires`, `fork`, `shock`, `cockpit`, `saddle`, `seatpost`, `motor`, `battery`, `frame_material`, … |
| manufacturer | text nullable | e.g. Shimano, SRAM |
| name | text | e.g. `Ultegra Di2 R8170` |
| tier | text nullable | e.g. `Ultegra`, `Dura-Ace` (for sorting/comparison) |
| spec_json | jsonb nullable | structured details per component type |
| created_at / updated_at | timestamptz | |

#### `model_variant_components`
| column | type | notes |
| --- | --- | --- |
| variant_id | uuid FK | |
| component_id | uuid FK | |
| role | text | how it's used; e.g. `front_wheel`, `rear_derailleur` (free text or enum TBD) |

PRIMARY KEY(variant_id, component_id, role).

Because variants are region-scoped (see above), regional component differences fall out naturally: the EU and US variants of the same model year are distinct `model_variants` rows with their own `model_variant_components` rows. No region column is needed on this table.

#### `resellers`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| slug | text unique | |
| name | text | |
| website_url | text | |
| logo_url | text nullable | |
| region_id | uuid FK | primary operating region |
| countries | text[] | ships to |
| status | enum | `active`, `paused`, `archived` |
| robots_policy | enum | `respect`, `ignore_with_consent`, … — what robots.txt to honor |
| crawl_rate_limit_per_min | int default 10 | |
| created_at / updated_at | timestamptz | |

#### `inventory_items`
A specific product page at a reseller for a specific variant. The unit of crawling.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| reseller_id | uuid FK | |
| variant_id | uuid FK nullable | nullable while unmatched in catalog |
| product_url | text | full URL of the product page |
| reseller_sku | text nullable | |
| title_at_source | text nullable | last seen page title for fuzzy match |
| status | enum | `live`, `delisted`, `needs_review`, `archived` |
| first_seen_at | timestamptz | |
| last_crawled_at | timestamptz nullable | |
| last_success_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

UNIQUE(reseller_id, product_url).

#### `price_observations`
Append-only history of observed prices.

| column | type | notes |
| --- | --- | --- |
| id | bigserial PK | |
| inventory_item_id | uuid FK | |
| amount | numeric(10,2) | |
| currency | text | ISO 4217 |
| original_amount | numeric(10,2) nullable | crossed-out / regular price if discounted |
| crawl_run_id | uuid FK | provenance |
| captured_at | timestamptz | |

Indexes: (inventory_item_id, captured_at desc).

#### `stock_observations`
Append-only history of observed stock state.

| column | type | notes |
| --- | --- | --- |
| id | bigserial PK | |
| inventory_item_id | uuid FK | |
| status | enum | `in_stock`, `low_stock`, `out_of_stock`, `preorder`, `backorder`, `discontinued`, `unknown` |
| quantity | int nullable | when reseller exposes a number |
| size_breakdown_json | jsonb nullable | per-size stock when scraped |
| crawl_run_id | uuid FK | |
| captured_at | timestamptz | |

A materialized "current" view (or a `latest_price_id`/`latest_stock_id` pointer on `inventory_items`) keeps reads fast.

---

## 3. Crawler

### 3.1 Selectors

Each `inventory_item` needs to know how to extract `price` and `stock` from its page. Selectors are versioned per field per item.

#### `crawl_selectors`
The currently active selector for a (item, field) pair.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| inventory_item_id | uuid FK | |
| field | enum | `price`, `stock`, `title`, `original_price`, `size_breakdown` |
| current_version_id | uuid FK → crawl_selector_versions | |
| status | enum | `active`, `invalid`, `needs_human` |
| consecutive_failures | int default 0 | |
| updated_at | timestamptz | |

UNIQUE(inventory_item_id, field).

#### `crawl_selector_versions`
Append-only history; allows rollback and audit.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| selector_id | uuid FK | |
| version | int | monotonic per `selector_id` |
| selector_type | enum | `css`, `xpath`, `regex`, `json_path`, `meta_tag` |
| expression | text | e.g. `meta[itemprop="price"]::attr(content)` |
| post_process_json | jsonb nullable | normalization rules (strip currency, trim, parse number, locale, …) |
| origin | enum | `manual`, `ai_generated`, `imported` |
| llm_model | text nullable | recorded when AI-generated |
| llm_prompt_id | text nullable | recorded prompt template version |
| created_by | text | user id or `system` |
| created_at | timestamptz | |
| valid_from | timestamptz | when it became active |
| valid_to | timestamptz nullable | null = still in history; the row that is "active" matches `crawl_selectors.current_version_id` |

> Note: some resellers will have a *site-wide template* (e.g. Shopify) where one selector works for all products. Optional optimization: a `reseller_template_selectors` table, with per-item selectors overriding the template. Open question — start with per-item, promote to template later if patterns emerge.

### 3.2 Crawl runs

#### `crawl_runs`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| inventory_item_id | uuid FK | |
| started_at / finished_at | timestamptz | |
| status | enum | `success`, `partial`, `failed`, `blocked`, `timeout` |
| http_status | int nullable | |
| fetch_duration_ms | int nullable | |
| html_snapshot_url | text nullable | object storage key for the saved HTML (for debugging + AI regen) |
| trigger | enum | `schedule`, `manual`, `regen_validation`, `webhook` |
| error_class | text nullable | |
| error_message | text nullable | |

#### `crawl_field_results`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| crawl_run_id | uuid FK | |
| field | enum | matches `crawl_selectors.field` |
| selector_version_id | uuid FK | which selector was used |
| extracted_raw | text nullable | |
| extracted_normalized | text nullable | post-process applied |
| outcome | enum | `success`, `selector_missed`, `parse_failed`, `value_implausible`, `skipped` |
| confidence | numeric nullable | for AI-generated regeneration verification |

### 3.3 Self-healing flow

```
schedule due → fetch page → snapshot HTML → for each field:
   apply active selector
   ├─ success + plausible value → write observation, reset consecutive_failures
   └─ miss / implausible
        → increment consecutive_failures
        → on threshold (e.g. 2 consecutive failures):
              mark selector status = invalid
              enqueue selector_regen_job
```

`selector_regen_job`:
1. Load latest HTML snapshot.
2. Ask LLM: "find the selector for `<field>` in this HTML". Provide:
   - Field schema (price = numeric + currency; stock = enum).
   - Reseller hints (template type if known).
   - Examples of valid selectors for this reseller (positive examples) and last known invalid one (negative).
3. LLM returns one or more candidate selectors.
4. **Validate** each candidate against the snapshot AND optionally a fresh fetch:
   - Selector matches an element.
   - Extracted value parses (currency, number, enum).
   - Value is plausible (price within historical band, stock is a known enum).
5. If a candidate passes:
   - Insert new `crawl_selector_versions` row (origin = `ai_generated`).
   - Update `crawl_selectors.current_version_id`, status = `active`, reset counters.
   - Record `crawl_runs` row of type `regen_validation`.
6. If no candidate passes:
   - status = `needs_human`, push to admin review queue.

Constraints:
- Selector regeneration is rate-limited per reseller and globally (cost control).
- AI regen results are subject to a probation period: the next N successful real crawls must also produce plausible values before considering the selector "stable".

### 3.4 Crawler service

- Worker model (e.g. BullMQ / pg-boss on Postgres) — scheduled jobs per `inventory_item` based on a per-item interval and per-reseller rate limit.
- Fetcher: HTTP-first; headless browser (Playwright) fallback for JS-rendered pages. Per-reseller policy flag.
- Respects `robots.txt` unless reseller has consented otherwise (recorded on `resellers.robots_policy`).
- Stores raw HTML snapshots to object storage (S3-compatible) for at least the last successful + last failed crawl per item.

### 3.5 Versioning + audit

- Every change to a selector creates a new `crawl_selector_versions` row. Old versions remain queryable.
- Admin UI can diff versions, roll back, and re-run a specific version against a snapshot.

---

## 4. API

### 4.1 Conventions
- REST + JSON. Resource paths in kebab-case, plural.
- Versioned at `/api/v1/...`.
- Cursor-based pagination (`?cursor=...&limit=...`).
- Filtering via query params; complex queries return 400 (use search endpoint instead).
- `ETag` + `If-None-Match` on catalog endpoints (data is mostly static).
- Public endpoints are read-only and unauthenticated, but rate-limited per IP + optional API key for higher quota.
- Admin endpoints require authentication (see §6).

### 4.2 Public endpoints (v1)

Catalog:
- `GET /brands` — list, filter by `?country=`, `?slug=`
- `GET /brands/:slug`
- `GET /brands/:slug/models`
- `GET /models?brand=&category=&year=&region=`
- `GET /models/:brand-slug/:model-slug`
- `GET /models/:brand-slug/:model-slug/:year`
- `GET /models/:brand-slug/:model-slug/:year/variants`
- `GET /variants/:id`
- `GET /components?type=&manufacturer=`
- `GET /components/:id`

Resellers + inventory:
- `GET /resellers?region=&country=`
- `GET /resellers/:slug`
- `GET /resellers/:slug/inventory?in_stock=&min_price=&max_price=&category=&year=`
- `GET /variants/:id/offers?region=` — all reseller offers for a variant, sorted by current price
- `GET /variants/:id/price-history?reseller=&from=&to=`
- `GET /search?q=` — basic text search across brand + model + variant

Each offer payload:
```json
{
  "inventory_item_id": "…",
  "reseller": { "slug": "epic-bikes", "name": "Epic Bikes", "country": "FI" },
  "product_url": "https://…",
  "price": { "amount": 4299.00, "currency": "EUR" },
  "stock": { "status": "in_stock", "quantity": null },
  "last_checked_at": "2026-05-22T08:14:00Z"
}
```

### 4.3 Admin endpoints (v1)

Under `/api/v1/admin/...`:
- CRUD for brands, models, model years, variants, components, regions, resellers.
- `POST /admin/inventory-items` — register a new product URL for crawling.
- `GET /admin/inventory-items?status=&reseller=&needs_review=true`
- `POST /admin/inventory-items/:id/match` — link to a `variant_id`.
- `GET /admin/crawl-runs?item=&status=&since=`
- `POST /admin/inventory-items/:id/crawl-now`
- `GET /admin/selectors?status=needs_human` — review queue
- `POST /admin/selectors/:id/manual` — submit a hand-written selector (creates new version)
- `POST /admin/selectors/:id/regen` — force AI regeneration
- `POST /admin/selectors/:id/rollback?to_version=`

---

## 5. Admin Web UI

Next.js App Router pages, server-rendered where possible, mounted under `/admin`.

Pages (initial):
- **Dashboard**: crawler health (success rate, queue depth, selectors needing human, recent failures).
- **Brands / Models / Variants**: CRUD lists + detail pages with inline edit.
- **Components**: typed by category, with bulk import.
- **Resellers**: list, detail, configure crawl policy, rate limit, robots policy.
- **Inventory**: per-reseller table of products with current price/stock, last crawled, status. Bulk actions: pause crawl, force re-crawl, archive.
- **Inventory item detail**: page renders the latest HTML snapshot side-by-side with extracted values; price & stock history charts; selector versions list with diff view; "test selector" tool to run any expression against the saved HTML.
- **Selector review queue**: items needing human selectors. Each shows snapshot, AI's failed candidates with reasons, and a "save selector" form that validates before saving.
- **Catalog import**: upload CSV / paste structured data / trigger a crawl-and-import job from a source URL.
- **Crawl runs**: searchable log of recent runs with error details.

UI tech: Next.js + Tailwind + a component library (shadcn/ui likely). Tables paginated server-side. Server actions or admin API for mutations.

---

## 6. Auth & Access

- **Public API**: anonymous + optional API key for higher rate limits. API keys live in a `public_api_keys` table.
- **Admin**: email + password (Auth.js) or magic link initially. Roles:
  - `admin` — full access.
  - `editor` — catalog + inventory edits, no destructive ops, no user mgmt.
  - `crawler_operator` — selector review + crawl mgmt only.
- All admin mutations are written to an `audit_log` table (actor, action, target, before/after diff).

---

## 7. Tech Stack

- **Runtime**: Next.js 15 (App Router) + TypeScript. One codebase serves public API, admin UI, and admin API.
- **DB**: Postgres 16+. Migrations via Drizzle or Prisma (decision deferred — see open questions).
- **Background jobs**: pg-boss (Postgres-backed) initially for simplicity; revisit if throughput demands Redis/BullMQ.
- **Object storage**: S3-compatible (HTML snapshots).
- **Crawler**: Node workers using `undici` for fetch + Playwright for JS-rendered pages. Workers run as a separate process (`apps/worker`) sharing the DB.
- **LLM**: Anthropic Claude API for selector regeneration. Prompts versioned in repo; usage + cost tracked per call.
- **Observability**: structured logs (pino), Prometheus metrics, error tracking (Sentry).
- **Hosting**: TBD (Vercel for web; workers on a separate host like Fly/Railway since long-running).

### Repo layout (proposed)

```
/apps
  /web         Next.js (public API + admin UI + admin API)
  /worker      Crawler + selector-regen workers
/packages
  /db          Schema, migrations, query helpers
  /core        Domain types + shared logic (selector apply, normalizers)
  /crawler     Fetch + parse + selector engine (used by worker and admin test tool)
  /llm         LLM client + prompt templates
```

---

## 8. Catalog Ingestion

Sources for brand/model data are not finalized. Likely paths:
1. **Manual entry** via admin UI for high-value brands.
2. **CSV / JSON imports** for bulk seeding (mapped to schema in an import job).
3. **Manufacturer-site crawler** — same crawler infra as resellers, but targeting brand sites; output writes to catalog tables instead of inventory tables.
4. **Reseller-page reverse-fill** — when a new product page is crawled, run an extraction prompt to draft a `model_year` + `variant` candidate; surface in admin for confirmation before merging.

All ingestion paths write through a staging table (`catalog_import_candidates`) that requires editor approval before becoming a canonical row. Prevents bad data from polluting public API.

---

## 9. Open Questions

These should be resolved before or during implementation:

1. **Region-specific variants vs override table** — spec attaches `region_id` to `model_variants`, so a regional build is its own variant row (cleaner queries, slight duplication when most components are shared). Alternative was a `model_variant_components.region_id` override column with a resolution rule; not chosen.
2. **Reseller-template selectors** — start per-item, or model the shared template explicitly from day one? Spec starts per-item.
3. **Currency conversion** — store and serve only the native currency per reseller, or maintain converted prices at query time? Spec stores native only.
4. **Search backend** — Postgres full-text initially or jump straight to Meilisearch/Typesense? Spec stays in Postgres for v1.
5. **ORM** — Drizzle (lighter, SQL-first) vs Prisma (richer, more DX overhead). Both work.
6. **Robots.txt policy** — strict-respect default, with per-reseller opt-out via signed consent? Spec assumes yes.
7. **Snapshot retention** — keep all snapshots, or last-N per item? Storage cost vs forensic value. Spec: last successful + last failed, plus all snapshots from the last 30 days.
8. **AI regeneration cost ceiling** — global daily budget cap with backoff? Spec assumes yes but limit value TBD.
9. **Price plausibility band** — naive (±50% of last value) or learned per item? Spec starts naive.
10. **Internationalization of model names / descriptions** — single English string per field, or translatable? Spec is single-string for v1.

---

## 10. Phased Delivery (suggested)

**Phase 1 — Catalog foundation**
- Schema for brands, models, model years, variants, components, regions.
- Admin CRUD UI for the above.
- Public read API for catalog.
- Auth, audit log.

**Phase 2 — Resellers + inventory (manual selectors)**
- Resellers + inventory items schema and admin UI.
- Crawler worker with manually-written selectors.
- Price + stock observations, current views, admin charts.
- Public offers + price history endpoints.

**Phase 3 — Self-healing crawler**
- Snapshot storage.
- Selector versioning + invalidation rules.
- LLM regeneration pipeline + validation + probation.
- Selector review queue UI.

**Phase 4 — Scaled ingestion**
- Catalog import candidates + reverse-fill from reseller pages.
- Brand-site crawler.
- Public API keys + quota tiers.

---
