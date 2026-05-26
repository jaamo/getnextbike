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

Reseller ──< ResellerLocation >── Region
                  │
                  ├──< CrawlSelector ──< CrawlSelectorVersion        (online locations only)
                  │
                  └──< InventoryItem >── ModelVariant                (online locations only)
                            │
                            ├──< PriceObservation
                            ├──< StockObservation >── ResellerLocation  (one row per location reported on the page)
                            └──< CrawlRun ──< CrawlFieldResult
```

A variant is region-scoped: `region_id` can be null (global build) or a specific region (region-specific build with its own components, SKU, and notes).

A reseller is the **company/brand**. It owns one or more **locations**, each of which is either a `physical` store or an `online` storefront. **Inventory only attaches to online locations** — every tracked bike is fetched from a product page on a storefront. Physical locations exist as catalog metadata (address, hours, geo for store-locator views) and as the *target* of per-store availability reported by the online product page. If the online page exposes "in stock at Helsinki ✓, Tampere ✗", that produces one `stock_observations` row per location (online + each named physical store) rather than a JSON blob — keeps the model uniform and indexable. Resellers without any online presence can be listed as physical-only locations but carry no inventory in v1.

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
The company/brand. Channel-specific fields (URL, region, crawl policy) live on `reseller_locations`.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| slug | text unique | |
| name | text | |
| logo_url | text nullable | |
| description | text nullable | |
| primary_website_url | text nullable | marketing/landing site if distinct from any storefront |
| status | enum | `active`, `paused`, `archived` — cascades to all locations |
| created_at / updated_at | timestamptz | |

#### `reseller_locations`
A channel through which a reseller sells: either a physical store or an online storefront. A reseller has one or more locations. Pure-online resellers have a single `online` row; brick-and-mortar chains have one row per shop plus optionally an `online` row.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| reseller_id | uuid FK → resellers | |
| slug | text | unique per reseller; e.g. `helsinki-central`, `online` |
| kind | enum | `physical`, `online` |
| name | text | human label, e.g. `Helsinki Central Store`, `Online Store` |
| region_id | uuid FK → regions | region this channel operates in (drives currency + variant resolution) |
| status | enum | `active`, `paused`, `archived` |
| country_code | text nullable | ISO 3166-1 alpha-2 — physical: store country; online: primary billing country |
| countries_served | text[] nullable | online: shipping destinations; physical: usually `[country_code]` or null |
| created_at / updated_at | timestamptz | |
| **physical-only fields** | | populated when `kind = 'physical'`, else null |
| address_line1 | text | |
| address_line2 | text nullable | |
| city | text | |
| postal_code | text | |
| latitude | numeric(9,6) nullable | |
| longitude | numeric(9,6) nullable | |
| phone | text nullable | |
| email | text nullable | |
| opening_hours_json | jsonb nullable | structured weekly hours + exceptions |
| timezone | text nullable | IANA tz, e.g. `Europe/Helsinki` |
| **online-only fields** | | populated when `kind = 'online'`, else null |
| storefront_url | text | base URL of the online store |
| robots_policy | enum | `respect`, `ignore_with_consent`, … — applies to crawling this storefront |
| crawl_rate_limit_per_min | int default 10 | |
| renders_with_js | bool default false | hint to crawler: use headless browser |

UNIQUE(reseller_id, slug). CHECK enforces that physical-only and online-only fields are populated iff `kind` matches. A reseller may have multiple `online` rows (e.g. localized `.fi` + `.se` storefronts treated as separate channels with distinct regions and crawler configs).

`reseller_locations.region_id` — not `resellers.region_id` — is what the variant-resolution rule (see `model_variants` above) uses to pick the right regional build for an inventory item.

#### `inventory_items`
A specific product page on a specific online storefront for a specific variant. The unit of crawling.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| reseller_location_id | uuid FK → reseller_locations | must be `kind = 'online'` (enforced by CHECK or trigger) |
| variant_id | uuid FK nullable | nullable while unmatched in catalog |
| product_url | text | full URL of the product page on the storefront |
| reseller_sku | text nullable | |
| title_at_source | text nullable | last seen page title for fuzzy match |
| status | enum | `live`, `delisted`, `needs_review`, `archived` |
| first_seen_at | timestamptz | |
| last_crawled_at | timestamptz nullable | |
| last_success_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

UNIQUE(reseller_location_id, product_url).

**Per-physical-store availability** (when the storefront exposes it on the product page) is captured as separate `stock_observations` rows, one per location — see that table below. When the storefront does not expose this data, the only stock row written per crawl is for the online location itself; the reseller's physical locations remain visible in the catalog but carry no stock signal. This is the only ingestion path for physical-store stock in v1 — no manual entry, no POS feeds.

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
Append-only history of observed stock state. Each crawl run writes **one row per location reported on the product page**: always one for the inventory item's own online location, plus one for each physical store the page names (e.g. *"in stock at Helsinki ✓, Tampere ✗"* → two extra rows).

| column | type | notes |
| --- | --- | --- |
| id | bigserial PK | |
| inventory_item_id | uuid FK | the crawled product page |
| reseller_location_id | uuid FK → reseller_locations | which location this row is about — the inventory item's own online location, or one of the reseller's physical stores |
| status | enum | `in_stock`, `low_stock`, `out_of_stock`, `preorder`, `backorder`, `discontinued`, `unknown` |
| quantity | int nullable | when reseller exposes a number |
| size_breakdown_json | jsonb nullable | per-size stock at THIS location |
| crawl_run_id | uuid FK | |
| captured_at | timestamptz | |

Constraint: `reseller_location_id` must belong to the same reseller as `inventory_item.reseller_location.reseller_id` (enforced by trigger). Index: `(inventory_item_id, reseller_location_id, captured_at desc)`.

**Current state** for read endpoints: a view `current_stock` defined as `SELECT DISTINCT ON (inventory_item_id, reseller_location_id) … ORDER BY inventory_item_id, reseller_location_id, captured_at DESC`. Price stays per-item (the `latest_price_id` pointer pattern still works for `price_observations`); stock requires the per-location view because a single inventory item now has multiple "latest" rows.

#### `catalog_sources`
A brand-site page (or seed URL) the crawler periodically fetches and turns into catalog candidates via LLM extraction (§3.7). The "catalog crawling" counterpart of `inventory_items`.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| brand_id | uuid FK → brands nullable | scoped to one brand when known; null means "discover the brand from the page content" |
| source_url | text | the URL to fetch |
| kind | enum | `model_index` (lists many models, follow-links allowed), `model_detail` (one model + its years/variants), `seed` (arbitrary page to crawl for catalog hints) |
| crawl_interval_minutes | int default 43200 | default monthly — models don't change often |
| renders_with_js | bool default false | hint for the fetcher |
| status | enum | `active`, `paused`, `archived` |
| last_crawled_at | timestamptz nullable | |
| last_success_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

UNIQUE(source_url). When a `model_index` page is crawled, newly discovered model URLs are appended as additional `catalog_sources` rows of kind `model_detail` (deduped on URL).

#### `catalog_import_candidates`
Staging area for catalog data extracted from any source — brand crawler, reseller reverse-fill, CSV import, manual entry. Editor approves a candidate, which merges it into canonical `brands` / `models` / `model_years` / `model_variants` / `model_variant_components` rows. Nothing reaches the canonical tables (and therefore the public API) without review.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| source | enum | `brand_crawl`, `reseller_reverse_fill`, `csv_import`, `manual` |
| source_ref_kind | enum nullable | `catalog_source`, `inventory_item`, `file` — type of the provenance pointer |
| source_ref_id | uuid nullable | catalog_source_id or inventory_item_id, depending on `source_ref_kind` |
| source_ref_label | text nullable | filename or other free-form label when no FK fits |
| extracted_json | jsonb | full LLM (or import) output, validated against the candidate schema |
| brand_slug | text nullable | hint at the canonical brand if the extractor was confident |
| status | enum | `pending`, `approved`, `rejected`, `duplicate`, `merged` |
| reviewer_id | text nullable | |
| reviewed_at | timestamptz nullable | |
| review_notes | text nullable | |
| merged_model_id | uuid FK → models nullable | populated on approve+merge — back-pointer to what got created/updated |
| llm_call_id | uuid FK → llm_calls nullable | provenance for cost attribution |
| created_at / updated_at | timestamptz | |

Indexes: `(status, created_at)`, `(brand_slug)`.

### 2.3 Operational tables

These don't carry domain data — they support runtime configuration, audit, and observability.

#### `system_settings`
Key/value table for UI-configurable runtime config. Single source of truth for anything an operator should be able to change without a deploy (AI budget, default crawl interval, feature flags, …).

| column | type | notes |
| --- | --- | --- |
| key | text PK | dotted namespace, e.g. `ai.daily_budget_usd` |
| value_json | jsonb | typed value (number, string, bool, object) |
| value_type | enum | `number`, `string`, `bool`, `enum`, `json` — drives UI rendering + validation |
| description | text | shown next to the field in the Settings UI |
| updated_by | text nullable | actor id |
| updated_at | timestamptz | |

Initial keys (seeded on first boot):

| key | type | default | meaning |
| --- | --- | --- | --- |
| `ai.daily_budget_usd` | number | `5.00` | hard cap on combined LLM spend per UTC day |
| `ai.monthly_budget_usd` | number | `100.00` | hard cap per calendar month |
| `ai.on_exceed` | enum | `queue` | `queue` = delay job until budget resets; `drop` = skip + leave selector `needs_human`; `alert_only` = warn but proceed |
| `ai.per_storefront_daily_max_regens` | number | `3` | extra cap to stop a single misbehaving storefront from eating the global budget |
| `crawler.default_interval_minutes` | number | `360` | default per-item crawl interval when not overridden |

All changes go through the audit log (§6).

---

## 3. Crawler

### 3.1 Selectors

Selectors apply to **inventory crawling only** — price/stock extraction from reseller storefronts. Catalog crawling (brand sites) doesn't use CSS selectors; it uses LLM extraction directly (§3.7) because catalog pages are richer and more variable than product pages, and per-field selectors don't generalize well.

Selectors are scoped to an online `reseller_location` (storefront) — every product page on a bike store uses the same template, so one selector per field covers the whole catalog. Selectors are versioned at the storefront level. No per-item override mechanism in v1.

#### `crawl_selectors`
The currently active selector for a (storefront, field) pair.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| reseller_location_id | uuid FK → reseller_locations | must be `kind = 'online'` (enforced by CHECK or trigger) |
| field | enum | `price`, `stock`, `title`, `original_price`, `size_breakdown` |
| current_version_id | uuid FK → crawl_selector_versions | |
| status | enum | `active`, `invalid`, `needs_human` |
| failed_item_ids | uuid[] default `{}` | rolling list of recent distinct inventory items where this field failed extraction — used by the invalidation rule in §3.3 |
| updated_at | timestamptz | |

UNIQUE(reseller_location_id, field).

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

### 3.2 Crawl runs

#### `crawl_runs`
A run targets either an `inventory_item` (price/stock crawl) or a `catalog_source` (catalog extraction). Exactly one of the two FK columns is set.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| inventory_item_id | uuid FK nullable | set for inventory crawls |
| catalog_source_id | uuid FK → catalog_sources nullable | set for catalog crawls (§3.7) |
| started_at / finished_at | timestamptz | |
| status | enum | `success`, `partial`, `failed`, `blocked`, `timeout` |
| http_status | int nullable | |
| fetch_duration_ms | int nullable | |
| html_snapshot_url | text nullable | relative path within the snapshots volume — `inventory/<reseller_location_id>/<inventory_item_id>/<crawl_run_id>.html` or `catalog/<catalog_source_id>/<crawl_run_id>.html`; backend abstracted in `/packages/core` so this can become an S3 key later |
| trigger | enum | `schedule`, `manual`, `regen_validation`, `webhook` |
| error_class | text nullable | |
| error_message | text nullable | |

CHECK: exactly one of `inventory_item_id`, `catalog_source_id` is non-null.

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
schedule due → fetch page (one item) → snapshot HTML → for each field:
   apply storefront's active selector
   ├─ success + plausible value → write observation, clear this item from failed_item_ids
   └─ miss / implausible
        → record failure: add item to failed_item_ids (capped sliding window of last ~20)
        → if ≥ 3 distinct items in failed_item_ids AND ≥ 50% of the last 10 extractions
          for (storefront, field) failed:
              mark selector status = invalid
              enqueue selector_regen_job
```

The multi-item threshold is what makes a template-level selector safe: one weird product page can't take down a whole storefront's crawl by itself.

`selector_regen_job` (runs once per `(storefront, field)`):
1. Load the **N most recent HTML snapshots** from this storefront, drawn from distinct inventory items (default N=5). More signal beats one snapshot.
2. Ask LLM: "find the selector for `<field>` that works across these pages". Provide:
   - Field schema (price = numeric + currency; stock = enum).
   - Storefront hints (platform type if known — Shopify, WooCommerce, custom).
   - Examples of valid selectors for similar storefronts (positive examples) and last known invalid one (negative).
3. LLM returns one or more candidate selectors.
4. **Validate** each candidate against **all loaded snapshots** plus optionally a fresh fetch of one item:
   - Selector matches an element on every snapshot.
   - Extracted value parses on every snapshot (currency, number, enum).
   - Values are plausible (price within historical band per item, stock is a known enum).
   - Reject any candidate that succeeds on fewer than (N-1) snapshots.
5. If a candidate passes:
   - Insert new `crawl_selector_versions` row (origin = `ai_generated`).
   - Update `crawl_selectors.current_version_id`, status = `active`, clear `failed_item_ids`.
   - Record `crawl_runs` rows of type `regen_validation` (one per validated snapshot).
6. If no candidate passes:
   - status = `needs_human`, push to admin review queue.

Constraints:
- Every LLM call goes through the budget gate in §3.6 — daily/monthly USD ceilings and a per-storefront daily regen cap, both configurable from the admin Settings UI.
- AI regen results are subject to a probation period: the next N **crawls across the storefront** (default N=10, across at least 3 distinct items) must produce plausible values before the selector is considered "stable".

### 3.4 Crawler service

- Worker model (e.g. BullMQ / pg-boss on Postgres) — scheduled jobs per `inventory_item` based on a per-item interval and per-reseller rate limit.
- Fetcher: HTTP-first; headless browser (Playwright) fallback for JS-rendered pages. Per-reseller policy flag.
- Respects `robots.txt` unless the storefront has consented otherwise (recorded on `reseller_locations.robots_policy`).
- Stores raw HTML snapshots to a local Docker volume mounted at `/var/lib/getnextbike/snapshots`. Retention: **7 days**, enforced by an hourly sweep job in the worker (§11.4). The last successful + last failed crawl per item are pinned regardless (small extra cost, big debugging value). Access goes through a small storage abstraction in `/packages/core` so the implementation can be swapped for S3 later without touching call sites.

### 3.5 Versioning + audit

- Every change to a selector creates a new `crawl_selector_versions` row. Old versions remain queryable.
- Admin UI can diff versions, roll back, and re-run a specific version against a snapshot.

### 3.6 AI cost tracking & budget

Every LLM call (selector regen, catalog extraction, variant reverse-fill, anything else) is recorded with its full cost, and every call goes through a budget gate first. Ceilings live in `system_settings` (§2.3) so an operator can change them from the admin UI without a deploy.

#### `llm_calls`
Append-only log of every LLM invocation.

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| purpose | enum | `selector_regen`, `catalog_extraction`, `variant_reverse_fill`, `other` |
| provider | text | `anthropic` |
| model | text | model ID, e.g. `claude-opus-4-7` |
| prompt_id | text | versioned prompt template name |
| input_tokens | int | |
| output_tokens | int | |
| cache_read_tokens | int default 0 | for prompt caching |
| cache_write_tokens | int default 0 | |
| cost_usd | numeric(10,6) | computed at call time from the model price table in `/packages/llm` |
| latency_ms | int nullable | |
| outcome | enum | `success`, `error`, `cancelled_by_budget` |
| error_class | text nullable | |
| reseller_location_id | uuid FK nullable | populated when the call is scoped to a storefront |
| crawl_run_id | uuid FK nullable | |
| selector_id | uuid FK nullable | |
| called_at | timestamptz | |

Indexes: `(called_at desc)`, `(purpose, called_at desc)`, `(reseller_location_id, called_at desc)`.

`cost_usd` is computed locally from a versioned price table keyed by `(provider, model)`. The price table is part of the codebase and updated when provider pricing changes — single source of truth, no runtime dependency on the provider's billing API.

#### Budget gate (runs before every LLM call)

```
gate(purpose, reseller_location_id, est_cost_usd):
   load settings: daily_budget, monthly_budget, on_exceed, per_storefront_daily_max
   spent_today   = SUM(cost_usd) FROM llm_calls WHERE called_at >= today_utc
   spent_month   = SUM(cost_usd) FROM llm_calls WHERE called_at >= month_start_utc
   regens_today_for_storefront = COUNT(*) FROM llm_calls
                                  WHERE purpose='selector_regen'
                                    AND reseller_location_id = $1
                                    AND called_at >= today_utc

   if spent_today + est_cost > daily_budget
      or spent_month + est_cost > monthly_budget
      or (purpose='selector_regen' AND regens_today_for_storefront >= per_storefront_daily_max):

      switch on_exceed:
        "queue"       → re-enqueue job with delay until budget resets (next UTC day for daily, next month for monthly)
        "drop"        → record llm_calls row with outcome='cancelled_by_budget', cost_usd=0; selector stays needs_human
        "alert_only"  → proceed, but emit a warning event surfaced on the Dashboard
```

The per-storefront cap matters because one misbehaving site (e.g. an A/B test rolling out a layout change for a few hours) could otherwise burn the entire global budget by triggering regen on every item. Cap is hit independently of the global budget.

#### Reporting

- Daily and monthly rollups computed on demand from `llm_calls` (small enough table for a long time; add a materialized view if needed).
- Surfaced in the admin AI Usage page (§5): spend over time, breakdown by `purpose` and by storefront, cache hit ratio, success vs. error vs. budget-cancelled, recent expensive calls.
- Dashboard tile shows `spent_today / daily_budget` and `spent_month / monthly_budget` with a green/yellow/red status indicator.

### 3.7 Catalog extraction

Catalog data comes through the same crawler infrastructure as inventory — same worker, same fetcher, same snapshot storage, same rate limiter, same budget gate — but with one big difference: extraction is **a single LLM call per page**, not a set of CSS selectors. Catalog pages are richer (one page describes a model, its years, every variant build with components and sizes) and far more variable across brands than reseller product templates, so per-field selectors don't pay off.

Per-page pipeline (one `crawl_runs` row per execution, with `catalog_source_id` set):

1. Fetch the page (HTTP or Playwright per `renders_with_js`), snapshot HTML to `catalog/<catalog_source_id>/<crawl_run_id>.html`.
2. Send the HTML + a structured prompt to the LLM: *"extract every model, year, and variant on this page. Return JSON matching this schema."* The schema mirrors the canonical catalog model (`models`, `model_years`, `model_variants`, `model_variant_components`) so the candidate maps directly into approval/merge logic.
3. Validate the LLM output against the schema (required fields, types, plausibility — e.g. year between 1980 and current+2, weight grams within 5–60 kg, frame sizes from a known vocabulary).
4. Insert one `catalog_import_candidates` row per discovered model (`status = pending`), each carrying its full extracted JSON, the source pointer, and the `llm_call_id`.
5. If `kind = model_index` and the LLM also returned a list of model-detail URLs, append them as new `catalog_sources` rows (kind `model_detail`, dedup on URL) for future crawls.

**Cost gate**: same `gate(...)` from §3.6. `purpose = catalog_extraction` (or `variant_reverse_fill` when called from a reseller page that lacks a matched variant). Catalog extraction is typically more expensive per call than selector regen (full page → Opus) so a separate per-brand daily cap is useful: `ai.per_brand_daily_max_catalog_calls` in `system_settings`, default `10`.

**Reseller reverse-fill** is the same pipeline triggered from a different source: when an `inventory_items` row is crawled and `variant_id IS NULL`, we run the LLM on that page's snapshot to draft a model+variant candidate. No extra page fetch; reuses the existing crawl's HTML. Output again lands in `catalog_import_candidates` with `source = reseller_reverse_fill`.

**Scheduling**: catalog crawls run on `catalog_sources.crawl_interval_minutes` (default monthly). Manual re-crawl is available from the admin UI. Inventory crawls keep their existing per-item cadence — the two schedules don't interfere; they share the same worker pool and rate limits.

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
- `GET /resellers/:slug` — includes all locations
- `GET /resellers/:slug/locations?kind=physical|online&region=`
- `GET /resellers/:slug/locations/:location-slug`
- `GET /resellers/:slug/inventory?location=&in_stock=&min_price=&max_price=&category=&year=` — defaults to all locations; pass `location=` (slug) to scope to one
- `GET /locations/:id/inventory?…` — same shape, scoped to one location across resellers (e.g. for map/store-locator views)
- `GET /variants/:id/offers?region=&kind=` — all location-level offers for a variant, sorted by current price; `kind=` filters online-only or physical-only
- `GET /variants/:id/price-history?reseller=&location=&from=&to=`
- `GET /search?q=` — basic text search across brand + model + variant

Each offer represents one product listing on one online storefront. Per-location availability for that listing is nested inside as an `availability` array, so the UI can render *"Epic Bikes — in stock online, at Helsinki ✓, Tampere ✗"* as a single grouped row:

```json
{
  "inventory_item_id": "…",
  "reseller": { "slug": "epic-bikes", "name": "Epic Bikes" },
  "product_url": "https://…",
  "price": { "amount": 4299.00, "currency": "EUR" },
  "availability": [
    {
      "location": {
        "slug": "online",
        "kind": "online",
        "name": "Online Store",
        "storefront_url": "https://epic-bikes.fi",
        "countries_served": ["FI", "SE"]
      },
      "stock": { "status": "in_stock", "quantity": null },
      "last_checked_at": "2026-05-22T08:14:00Z"
    },
    {
      "location": {
        "slug": "helsinki-central",
        "kind": "physical",
        "name": "Helsinki Central Store",
        "city": "Helsinki",
        "country": "FI",
        "lat": 60.1699,
        "lng": 24.9384
      },
      "stock": { "status": "in_stock" },
      "last_checked_at": "2026-05-22T08:14:00Z"
    },
    {
      "location": {
        "slug": "tampere",
        "kind": "physical",
        "name": "Tampere Store",
        "city": "Tampere",
        "country": "FI"
      },
      "stock": { "status": "out_of_stock" },
      "last_checked_at": "2026-05-22T08:14:00Z"
    }
  ]
}
```

`availability` always contains at least one entry — the online location itself. Physical-location entries appear only when the storefront's product page reports stock for those stores (§2.2 stock_observations). If a reseller runs multiple online storefronts (e.g. `.fi` + `.se`), each storefront yields its own offer.

### 4.3 Admin endpoints (v1)

Under `/api/v1/admin/...`:
- CRUD for brands, models, model years, variants, components, regions, resellers, **reseller locations**.
- `POST /admin/resellers/:id/locations` — add a physical store or online storefront.
- `POST /admin/inventory-items` — register a new product URL (online location) or a manual stock row (physical location) for crawling/tracking.
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
- **Resellers**: list + detail. Detail page shows all locations (physical + online) for the reseller, with map view for physical stores.
- **Reseller location**: per-location config — for online, crawl policy / rate limit / robots / JS rendering hint; for physical, address / hours / contact / geo. Inventory tab scoped to this location.
- **Inventory**: per-reseller-location table of products with current price/stock, last crawled, status. Cross-location view shows the same variant across all of a reseller's channels side by side. Bulk actions: pause crawl, force re-crawl, archive.
- **Inventory item detail**: latest HTML snapshot side-by-side with extracted values; price & stock history charts. Selectors are not edited here (they live at the storefront level); the "test selector" tool can run an arbitrary expression against this item's snapshot for debugging.
- **Storefront selectors**: per online `reseller_location`, one row per field (`price`, `stock`, …). Shows current selector, version history with diff view, list of recent failures (which items broke and why), and the "test selector" tool — runs any expression against any of the storefront's recent snapshots. Edit form creates a new version on save and validates against the last N snapshots before activating.
- **Selector review queue**: storefronts × fields where the active selector is `needs_human`. Each entry shows multiple item snapshots from that storefront, the AI's failed candidates with reasons, and a "save selector" form that validates against all loaded snapshots before saving.
- **Catalog sources**: per-brand list of registered `catalog_sources` (brand-site URLs). Status, last run, success rate, recent candidates produced. Add/remove URLs; pause; trigger an immediate re-crawl.
- **Catalog candidate review**: pending `catalog_import_candidates`, grouped by brand. Side-by-side view of extracted JSON + source HTML snapshot. Actions: approve & merge (with conflict surfacing for "model already exists" → merge into existing vs. create new), reject, mark duplicate. Bulk approve for high-confidence batches.
- **Catalog import**: upload CSV / paste structured data, written into `catalog_import_candidates` for review like any other source.
- **Crawl runs**: searchable log of recent runs (inventory + catalog) with error details.
- **AI usage**: dashboard for §3.6 — spend over time (daily/monthly), breakdown by `purpose` and storefront, cache hit ratio, success vs. error vs. budget-cancelled, recent expensive calls. Current-spend tiles vs. ceilings with green/yellow/red status.
- **Settings**: edit `system_settings` rows (§2.3). Grouped sections for AI budget (`ai.daily_budget_usd`, `ai.monthly_budget_usd`, `ai.on_exceed`, `ai.per_storefront_daily_max_regens`) and crawler defaults. Form validation derives from `value_type`; every change writes to the audit log.

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
- **DB**: Postgres 16+. Schema + migrations via Drizzle (SQL-first, lightweight runtime, diff-able migrations).
- **Background jobs**: pg-boss (Postgres-backed) initially for simplicity; revisit if throughput demands Redis/BullMQ.
- **Snapshot storage**: local filesystem on a Docker volume. Storage access wrapped in `/packages/core` so it can be swapped for S3 later.
- **Crawler**: Node workers using `undici` for fetch + Playwright for JS-rendered pages. Workers run as a separate process (`apps/worker`) sharing the DB.
- **LLM**: Anthropic Claude API for selector regeneration. Prompts versioned in repo; usage + cost tracked per call.
- **Observability**: structured logs (pino) to a host-mounted log directory. No metrics or error-tracking integrations in v1.
- **Hosting**: Docker Compose on a single Linux host (Debian 12 / Ubuntu 24.04 LTS). Containers: `web`, `worker`, `postgres`, plus a one-shot `migrate` job. The host's existing Caddy fronts everything — no reverse proxy in this project. Snapshots live on a local Docker volume. See §11.

### Repo layout (proposed)

```
/apps
  /web         Next.js (public API + admin UI + admin API) + Dockerfile
  /worker      Crawler + selector-regen workers + Dockerfile
/packages
  /db          Schema, migrations, query helpers
  /core        Domain types + shared logic (selector apply, normalizers)
  /crawler     Fetch + parse + selector engine (used by worker and admin test tool)
  /llm         LLM client + prompt templates
/infra
  compose.yaml           production compose file
  compose.override.yaml  local dev overrides (hot reload, bound to 0.0.0.0:3000)
  scripts/               deploy.sh
```

---

## 8. Catalog Ingestion

Catalog data is collected through the same crawler infrastructure used for inventory (§3) — the worker, fetcher, snapshot store, rate limiter, and cost gate are all shared. Catalog extraction itself is LLM-based rather than selector-based (§3.7) because catalog pages are richer and more variable than reseller product templates.

Three input paths converge on the `catalog_import_candidates` staging table (§2.2):

1. **Brand-site crawler** (§3.7) — periodic LLM extraction from URLs registered in `catalog_sources`. Primary ingestion path; produces the bulk of candidates. `model_index` pages auto-discover `model_detail` URLs to enqueue for future crawls.
2. **Reseller reverse-fill** (§3.7) — when an `inventory_items` row is crawled and `variant_id IS NULL`, the LLM runs against that page's existing snapshot to draft a model+variant candidate. No extra page fetches. Catches catalog items that brand sites haven't published yet (or that the brand crawler hasn't reached).
3. **CSV / JSON / manual** — bulk seeding and direct admin entry, written straight into `catalog_import_candidates` with `source = csv_import` or `manual`.

All three converge on the same staging table and the same review flow. An editor approves a candidate from the admin UI; approval performs an atomic merge into canonical `brands` / `models` / `model_years` / `model_variants` / `model_variant_components` rows, marks the candidate `status = merged`, and back-fills `merged_model_id`. Conflicts (e.g. "this model already exists") are surfaced at approval time so the reviewer can choose merge-into-existing vs. create-new. Nothing reaches the canonical tables — and therefore the public API — without an editor's review.

---

## 9. Open Questions

_All initial design questions have been resolved. New questions arising during implementation are tracked here._

---

## 10. Phased Delivery (suggested)

**Phase 1 — Catalog foundation**
- Schema for brands, models, model years, variants, components, regions.
- Admin CRUD UI for the above.
- Public read API for catalog.
- Auth, audit log.

**Phase 2 — Resellers + inventory (manual selectors)**
- Resellers + reseller locations (physical + online) + inventory items schema and admin UI.
- Crawler worker with manually-written selectors, targeting online locations only.
- Price observations + stock observations (per-location rows), current-state views, admin charts.
- Public offers (grouped by reseller, with per-location availability) + price history endpoints.

**Phase 3 — Self-healing crawler**
- Snapshot storage.
- Selector versioning + invalidation rules.
- LLM regeneration pipeline + validation + probation.
- Selector review queue UI.

**Phase 4 — Catalog crawler + scaled ingestion**
- `catalog_sources` + `catalog_import_candidates` schema and admin UI.
- LLM-based catalog extraction pipeline (§3.7) reusing the worker / snapshot / cost-gate infrastructure from Phase 2–3.
- Reseller reverse-fill triggered automatically when an inventory crawl produces an unmatched variant.
- Catalog candidate review queue with approve & atomic merge into canonical tables.
- Public API keys + quota tiers.

---

## 11. Deployment & Hosting

Docker Compose on a shared Linux host. The host already runs Caddy in front of several unrelated services, so this project does not include a reverse proxy, TLS handling, or object storage. The published web port is whatever the host's Caddy targets; snapshots live on a local Docker volume.

### 11.1 Topology

```
Internet ─▶ host's Caddy (out of scope) ─▶ web :3000 (host port, loopback)
                                                  │
   ┌──────────────────────────────────────────────┘
   │  docker network: getnextbike_internal
   ├─▶ worker (crawler + selector regen + pg-boss + snapshot sweeper)
   └─▶ postgres (16+, pg_trgm, pg-boss)

   shared volume: snapshots (mounted into web ro, worker rw)
```

Only `web` publishes a host port, bound to `127.0.0.1` so it's only reachable through the host's Caddy. Everything else stays on the internal Docker network. Compose project name `getnextbike`; `restart: unless-stopped` on every service.

### 11.2 Services

| service | image (base) | role | published ports |
| --- | --- | --- | --- |
| `web` | built from `apps/web/Dockerfile` (Node 22 alpine, multi-stage, Next.js standalone output) | public API + admin UI + admin API | `127.0.0.1:${WEB_PORT}` (default `3000`), consumed by host's Caddy |
| `worker` | built from `apps/worker/Dockerfile` (Node 22 on `mcr.microsoft.com/playwright:v1.x-jammy` base for headless Chromium) | crawler, selector regen, pg-boss scheduler, snapshot retention sweep | none |
| `migrate` | same image as `web`, overridden command `npm run db:migrate` | runs migrations to completion then exits; `web`/`worker` depend on it with `condition: service_completed_successfully` | none |
| `postgres` | `postgres:16-alpine` | primary database + pg-boss queue | none |

Optional / later: `prometheus`, `grafana`, `loki`, `promtail`.

The headless browser lives **inside** the worker container in v1 (Playwright base image). Split into a `browser` service later if multiple worker replicas need to share Chromium.

### 11.3 Host reverse proxy integration

Reverse proxy is the host's responsibility, not this project's. After deploy, the operator adds a stanza to the host's existing `Caddyfile` along the lines of:

```
api.getnextbike.example, admin.getnextbike.example {
    reverse_proxy 127.0.0.1:3000
}
```

This project does not ship a Caddyfile, does not manage TLS, does not know which domain it will be mounted under at deploy time, and never has to be redeployed to add or change a domain. The published port is the only contract.

### 11.4 Persistent state & volumes

Named Docker volumes:

| volume | mounted by | mount path | contents |
| --- | --- | --- | --- |
| `pg_data` | postgres | `/var/lib/postgresql/data` | database files |
| `snapshots` | web (ro), worker (rw) | `/var/lib/getnextbike/snapshots` | crawled HTML snapshots |

Bind mounts:
- `/etc/getnextbike/.env` → injected via `env_file:` directives, owned `root:docker`, mode `0640`.
- `/var/log/getnextbike/` → mounted into `web` and `worker` at the same path; pino writes `<service>.log` here. Host's `logrotate` handles rotation (§11.8).

Application containers (`web`, `worker`) are otherwise stateless — nothing in their filesystem outside the mounted volume survives a redeploy.

**Snapshot layout on disk**: `/var/lib/getnextbike/snapshots/inventory/<reseller_location_id>/<inventory_item_id>/<crawl_run_id>.html` for reseller crawls; `/var/lib/getnextbike/snapshots/catalog/<catalog_source_id>/<crawl_run_id>.html` for catalog crawls (§3.7). `crawl_runs.html_snapshot_url` stores the path relative to the volume root. A storage abstraction in `/packages/core` wraps reads/writes so the backend can be swapped for S3 later without touching call sites.

**Retention sweep**: an hourly worker job deletes snapshot files older than 7 days, except the most-recent success + most-recent failure per inventory item (pinned regardless of age). The pinned set is derived from `crawl_runs` — no separate index needed.

### 11.5 Configuration & secrets

- Single `/etc/getnextbike/.env` on the host, gitignored, deployed out-of-band (SCP via deploy script or `sops`/`age`-encrypted in repo).
- Compose reads it with `env_file: /etc/getnextbike/.env`; per-service `environment:` blocks pick specific keys to expose.
- Required keys: `POSTGRES_PASSWORD`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET`, `SENTRY_DSN`, `WEB_PORT` (default `3000`).
- Rotation: documented runbook; no auto-rotation in v1.
- Local dev uses a separate `.env.local` with throwaway credentials.

### 11.6 Build & deployment

Build happens on the prod server from a working copy of the repo — no container registry, no CI image pipeline. Keeps the deploy story self-contained: one host, one git remote, no external dependency on GHCR or similar.

**Deploy (server):**
1. SSH into the host, `cd /opt/getnextbike`.
2. `git pull` for source + `compose.yaml` changes.
3. `docker compose build` — multi-stage builds for `web` and `worker`. BuildKit cache is reused across deploys, so incremental builds are fast.
4. `docker compose up -d --remove-orphans`.
5. Compose runs `migrate` to completion before `web` and `worker` start (`depends_on` with `condition: service_completed_successfully`).
6. `docker image prune -f` (or rely on a weekly cron) so old layers from prior builds don't accumulate.
7. No reverse-proxy reload needed — the host's Caddy still points at the same port.

Wrapped in `infra/scripts/deploy.sh` (`git pull && docker compose build && docker compose up -d`) so the whole flow is one command.

**What CI does instead:** unit + integration tests, type-check, lint, and a `docker compose build` smoke check to catch Dockerfile breakage before it hits prod. No images are pushed anywhere.

When this stops fitting (multi-host, blue/green, zero-downtime, slow builds blocking deploys), revisit with a registry-based pipeline.

Image conventions:
- Multi-stage Dockerfiles. Final stage runs as non-root (`USER node`).
- Next.js uses `output: 'standalone'` so the runtime image is just node + the standalone bundle.
- Worker image inherits Playwright's base so Chromium + system libs are preinstalled and pinned.
- Healthchecks: `web` exposes `/api/health`, `worker` writes a heartbeat row + exposes `/health` on a private port, Postgres uses `pg_isready`.

### 11.7 Backups

Out of scope for this document. Backups (Postgres, snapshots) are handled by the host's existing backup infrastructure alongside the other services it hosts.

### 11.8 Observability

Logs only, v1. No metrics, no error-tracking SaaS, no uptime pinger — added later if pain justifies them.

- Both `web` and `worker` write structured JSON (pino) to `/var/log/getnextbike/<service>.log`, which is a host bind mount (`/var/log/getnextbike/` on the host, owned by the container user).
- Each container also keeps writing to stdout so `docker compose logs` works for quick inspection. Stdout is bounded by Docker's default log driver — log files on the host are the durable record.
- Rotation is handled by the host's `logrotate` (daily, compress, keep 14 days) — a sample config lives at `infra/logrotate/getnextbike` for the operator to symlink into `/etc/logrotate.d/`.
- Errors are logged at `level: error` with a stack trace; finding them is `grep '"level":50'` (pino's numeric severity) on the log file.

### 11.9 Local development parity

- Same `compose.yaml` with a `compose.override.yaml` that:
  - Replaces `web` and `worker` images with bind-mounted source + `npm run dev` / `tsx --watch`.
  - Binds `web` to `0.0.0.0:3000` for direct browser access.
  - Uses local-only credentials and a `getnextbike_dev` Postgres database.
  - Snapshot volume becomes a bind mount under `./.dev/snapshots` for easy inspection.
- Postgres image tag matches prod so schema behavior is identical.
- `docker compose up` is the only command a contributor needs after cloning.

### 11.10 Sizing & growth path

Starting point for v1 inventory volume (~10k inventory items, crawled every 6–24 h), assuming this project shares the host with other services:

| component | budget |
| --- | --- |
| this project's share of host | ~2 vCPU / 4 GB RAM / 30 GB disk |
| postgres | 2 GB RAM, 20 GB initial data, WAL on same disk |
| snapshots volume | 10 GB (bounded by the 7-day retention sweep, §11.4) |
| worker concurrency | 4 in-process fetchers + 1 Playwright instance |

Vertical scale path: move to a dedicated host, raise worker concurrency, tune Postgres `shared_buffers`. Horizontal scale path (out of scope for v1, but the architecture allows it): move Postgres to a managed instance, swap the snapshot volume implementation for S3 inside `/packages/core`, run `web` and `worker` as multiple replicas (they're stateless) behind the host's Caddy. At that point Compose stops being the right tool and we'd move to Nomad or Kubernetes.

---
