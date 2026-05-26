CREATE TYPE "public"."crawl_field_result_outcome" AS ENUM('success', 'selector_missed', 'parse_failed', 'value_implausible', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."crawl_run_status" AS ENUM('success', 'partial', 'failed', 'blocked', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."crawl_run_trigger" AS ENUM('schedule', 'manual', 'regen_validation', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."crawl_selector_field" AS ENUM('price', 'stock', 'title', 'original_price', 'size_breakdown');--> statement-breakpoint
CREATE TYPE "public"."crawl_selector_origin" AS ENUM('manual', 'ai_generated', 'imported');--> statement-breakpoint
CREATE TYPE "public"."crawl_selector_status" AS ENUM('active', 'invalid', 'needs_human');--> statement-breakpoint
CREATE TYPE "public"."crawl_selector_type" AS ENUM('css', 'xpath', 'regex', 'json_path', 'meta_tag');--> statement-breakpoint
CREATE TYPE "public"."inventory_item_status" AS ENUM('live', 'delisted', 'needs_review', 'archived');--> statement-breakpoint
CREATE TYPE "public"."reseller_location_kind" AS ENUM('physical', 'online');--> statement-breakpoint
CREATE TYPE "public"."reseller_location_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."robots_policy" AS ENUM('respect', 'ignore_with_consent');--> statement-breakpoint
CREATE TYPE "public"."reseller_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'low_stock', 'out_of_stock', 'preorder', 'backorder', 'discontinued', 'unknown');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_field_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crawl_run_id" uuid NOT NULL,
	"field" text NOT NULL,
	"selector_version_id" uuid,
	"extracted_raw" text,
	"extracted_normalized" text,
	"outcome" "crawl_field_result_outcome" NOT NULL,
	"confidence" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "crawl_run_status" NOT NULL,
	"http_status" integer,
	"fetch_duration_ms" integer,
	"html_snapshot_url" text,
	"trigger" "crawl_run_trigger" NOT NULL,
	"error_class" text,
	"error_message" text,
	CONSTRAINT "crawl_runs_inventory_item_id_required" CHECK ("crawl_runs"."inventory_item_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_selector_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selector_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"selector_type" "crawl_selector_type" NOT NULL,
	"expression" text NOT NULL,
	"post_process_json" jsonb,
	"origin" "crawl_selector_origin" DEFAULT 'manual' NOT NULL,
	"llm_model" text,
	"llm_prompt_id" text,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "crawl_selector_versions_selector_id_version_unique" UNIQUE("selector_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_selectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_location_id" uuid NOT NULL,
	"field" "crawl_selector_field" NOT NULL,
	"current_version_id" uuid,
	"status" "crawl_selector_status" DEFAULT 'active' NOT NULL,
	"failed_item_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crawl_selectors_location_field_unique" UNIQUE("reseller_location_id","field")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_location_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_url" text NOT NULL,
	"reseller_sku" text,
	"title_at_source" text,
	"status" "inventory_item_status" DEFAULT 'live' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_crawled_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_reseller_location_id_product_url_unique" UNIQUE("reseller_location_id","product_url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"original_amount" numeric(10, 2),
	"crawl_run_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reseller_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" "reseller_location_kind" NOT NULL,
	"name" text NOT NULL,
	"region_id" uuid NOT NULL,
	"status" "reseller_location_status" DEFAULT 'active' NOT NULL,
	"country_code" text,
	"countries_served" text[] DEFAULT '{}'::text[] NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"postal_code" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"phone" text,
	"email" text,
	"opening_hours_json" jsonb,
	"timezone" text,
	"storefront_url" text,
	"robots_policy" "robots_policy",
	"crawl_rate_limit_per_min" integer DEFAULT 10,
	"renders_with_js" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reseller_locations_reseller_id_slug_unique" UNIQUE("reseller_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"description" text,
	"primary_website_url" text,
	"status" "reseller_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resellers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"reseller_location_id" uuid NOT NULL,
	"status" "stock_status" NOT NULL,
	"quantity" integer,
	"size_breakdown_json" jsonb,
	"crawl_run_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_field_results" ADD CONSTRAINT "crawl_field_results_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_field_results" ADD CONSTRAINT "crawl_field_results_selector_version_id_crawl_selector_versions_id_fk" FOREIGN KEY ("selector_version_id") REFERENCES "public"."crawl_selector_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_selector_versions" ADD CONSTRAINT "crawl_selector_versions_selector_id_crawl_selectors_id_fk" FOREIGN KEY ("selector_id") REFERENCES "public"."crawl_selectors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_selectors" ADD CONSTRAINT "crawl_selectors_reseller_location_id_reseller_locations_id_fk" FOREIGN KEY ("reseller_location_id") REFERENCES "public"."reseller_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_reseller_location_id_reseller_locations_id_fk" FOREIGN KEY ("reseller_location_id") REFERENCES "public"."reseller_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_model_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."model_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reseller_locations" ADD CONSTRAINT "reseller_locations_reseller_id_resellers_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."resellers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reseller_locations" ADD CONSTRAINT "reseller_locations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_reseller_location_id_reseller_locations_id_fk" FOREIGN KEY ("reseller_location_id") REFERENCES "public"."reseller_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_observations" ADD CONSTRAINT "stock_observations_crawl_run_id_crawl_runs_id_fk" FOREIGN KEY ("crawl_run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_observations_item_captured_idx" ON "price_observations" USING btree ("inventory_item_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_observations_item_loc_captured_idx" ON "stock_observations" USING btree ("inventory_item_id","reseller_location_id","captured_at" DESC NULLS LAST);