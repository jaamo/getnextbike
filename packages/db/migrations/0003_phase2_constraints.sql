-- Phase 2 constraints + current_stock view.
--
-- 1. inventory_items + crawl_selectors can only reference online locations.
--    Postgres CHECK can't subquery, so triggers enforce the invariant.
-- 2. stock_observations.reseller_location must belong to the same reseller
--    as the inventory item's location.
-- 3. current_stock view: DISTINCT ON (item, location) most recent row.

CREATE OR REPLACE FUNCTION inventory_items_require_online_location()
RETURNS TRIGGER AS $$
DECLARE
  loc_kind text;
BEGIN
  SELECT kind::text INTO loc_kind
  FROM reseller_locations
  WHERE id = NEW.reseller_location_id;

  IF loc_kind IS NULL THEN
    RAISE EXCEPTION 'reseller_location % not found', NEW.reseller_location_id;
  ELSIF loc_kind <> 'online' THEN
    RAISE EXCEPTION 'inventory_items can only attach to online locations (got %)', loc_kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER inventory_items_require_online_location_trg
BEFORE INSERT OR UPDATE OF reseller_location_id ON inventory_items
FOR EACH ROW EXECUTE FUNCTION inventory_items_require_online_location();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION crawl_selectors_require_online_location()
RETURNS TRIGGER AS $$
DECLARE
  loc_kind text;
BEGIN
  SELECT kind::text INTO loc_kind
  FROM reseller_locations
  WHERE id = NEW.reseller_location_id;

  IF loc_kind IS NULL THEN
    RAISE EXCEPTION 'reseller_location % not found', NEW.reseller_location_id;
  ELSIF loc_kind <> 'online' THEN
    RAISE EXCEPTION 'crawl_selectors can only attach to online locations (got %)', loc_kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER crawl_selectors_require_online_location_trg
BEFORE INSERT OR UPDATE OF reseller_location_id ON crawl_selectors
FOR EACH ROW EXECUTE FUNCTION crawl_selectors_require_online_location();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION stock_observations_same_reseller()
RETURNS TRIGGER AS $$
DECLARE
  item_reseller uuid;
  loc_reseller uuid;
BEGIN
  SELECT rl.reseller_id INTO item_reseller
  FROM inventory_items ii
  JOIN reseller_locations rl ON rl.id = ii.reseller_location_id
  WHERE ii.id = NEW.inventory_item_id;

  SELECT reseller_id INTO loc_reseller
  FROM reseller_locations
  WHERE id = NEW.reseller_location_id;

  IF item_reseller IS NULL OR loc_reseller IS NULL THEN
    RAISE EXCEPTION 'stock_observations references missing inventory_item or reseller_location';
  ELSIF item_reseller <> loc_reseller THEN
    RAISE EXCEPTION 'stock_observations.reseller_location must belong to the inventory_item''s reseller';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER stock_observations_same_reseller_trg
BEFORE INSERT OR UPDATE OF reseller_location_id, inventory_item_id ON stock_observations
FOR EACH ROW EXECUTE FUNCTION stock_observations_same_reseller();
--> statement-breakpoint

CREATE OR REPLACE VIEW current_stock AS
SELECT DISTINCT ON (inventory_item_id, reseller_location_id)
  inventory_item_id,
  reseller_location_id,
  status,
  quantity,
  size_breakdown_json,
  captured_at
FROM stock_observations
ORDER BY inventory_item_id, reseller_location_id, captured_at DESC;
