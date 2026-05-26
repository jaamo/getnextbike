CREATE TYPE "public"."model_category" AS ENUM('road', 'gravel', 'mtb_xc', 'mtb_trail', 'mtb_enduro', 'mtb_dh', 'hybrid', 'commuter', 'city', 'cargo', 'kids', 'bmx', 'ebike_road', 'ebike_mtb', 'ebike_city', 'ebike_cargo', 'ebike_commuter');--> statement-breakpoint
CREATE TYPE "public"."component_type" AS ENUM('groupset', 'drivetrain', 'brakes', 'wheels', 'tires', 'fork', 'shock', 'cockpit', 'saddle', 'seatpost', 'motor', 'battery', 'frame_material', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_currency" text NOT NULL,
	"countries" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text,
	"website_url" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "model_category" NOT NULL,
	"discipline_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "models_brand_id_slug_unique" UNIQUE("brand_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"msrp_amount" numeric(10, 2),
	"msrp_currency" text,
	"hero_image_url" text,
	"spec_sheet_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_years_model_id_year_unique" UNIQUE("model_id","year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_year_region_availability" (
	"model_year_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"msrp_amount" numeric(10, 2),
	"msrp_currency" text,
	"available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "model_year_region_availability_model_year_id_region_id_pk" PRIMARY KEY("model_year_id","region_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_year_id" uuid NOT NULL,
	"region_id" uuid,
	"sku" text,
	"build_name" text,
	"frame_size" text,
	"color" text,
	"weight_grams" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "component_type" NOT NULL,
	"manufacturer" text,
	"name" text NOT NULL,
	"tier" text,
	"spec_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_variant_components" (
	"variant_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "model_variant_components_variant_id_component_id_role_pk" PRIMARY KEY("variant_id","component_id","role")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "models" ADD CONSTRAINT "models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_years" ADD CONSTRAINT "model_years_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_year_region_availability" ADD CONSTRAINT "model_year_region_availability_model_year_id_model_years_id_fk" FOREIGN KEY ("model_year_id") REFERENCES "public"."model_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_year_region_availability" ADD CONSTRAINT "model_year_region_availability_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_variants" ADD CONSTRAINT "model_variants_model_year_id_model_years_id_fk" FOREIGN KEY ("model_year_id") REFERENCES "public"."model_years"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_variants" ADD CONSTRAINT "model_variants_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_variant_components" ADD CONSTRAINT "model_variant_components_variant_id_model_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."model_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_variant_components" ADD CONSTRAINT "model_variant_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "model_variants_identity_unique" ON "model_variants" USING btree ("model_year_id","region_id","build_name","frame_size","color");