-- ============================================================
-- SiamClones — Supabase Backend Upgrades
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- 1. ADD NOTIFICATION FIELDS TO PROFILES
-- ============================================================
-- Adds email + LINE notification support for vendors
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_email TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_token TEXT,
  ADD COLUMN IF NOT EXISTS promptpay_id TEXT;

COMMENT ON COLUMN profiles.notification_email IS 'Email address for order notifications (defaults to auth email if null)';
COMMENT ON COLUMN profiles.line_notify_token IS 'LINE Notify API token for push notifications (optional)';
COMMENT ON COLUMN profiles.promptpay_id IS 'PromptPay phone number or citizen ID for QR payment (optional)';


-- Add payment_method column to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';

COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod (cash on delivery) or promptpay';


-- ============================================================
-- 2. RATE LIMITING: ORDERS (max 10 orders per hour per buyer)
-- ============================================================
-- This function counts recent orders from the same phone number
CREATE OR REPLACE FUNCTION check_order_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM orders
  WHERE customer_phone = NEW.customer_phone
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 orders per hour.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists first to allow re-running
DROP TRIGGER IF EXISTS order_rate_limit_trigger ON orders;

CREATE TRIGGER order_rate_limit_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_order_rate_limit();


-- ============================================================
-- 3. RATE LIMITING: LISTINGS (max 20 listings per vendor)
-- ============================================================
CREATE OR REPLACE FUNCTION check_listing_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  listing_count INTEGER;
  recent_count INTEGER;
BEGIN
  -- Max 20 total listings per vendor
  SELECT COUNT(*) INTO listing_count
  FROM listings
  WHERE seller_id = NEW.seller_id;

  IF listing_count >= 20 THEN
    RAISE EXCEPTION 'Maximum of 20 listings per vendor reached.';
  END IF;

  -- Max 5 new listings per hour (spam prevention)
  SELECT COUNT(*) INTO recent_count
  FROM listings
  WHERE seller_id = NEW.seller_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 new listings per hour.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS listing_rate_limit_trigger ON listings;

CREATE TRIGGER listing_rate_limit_trigger
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION check_listing_rate_limit();


-- ============================================================
-- 4. WEBHOOK FUNCTION: Notify vendor on new order
-- ============================================================
-- This creates a database function that can be called by
-- a Supabase database webhook or pg_net extension.
-- It prepares the notification payload.

CREATE OR REPLACE FUNCTION notify_vendor_new_order()
RETURNS TRIGGER AS $$
DECLARE
  vendor_record RECORD;
  notification_payload JSONB;
BEGIN
  -- Get the vendor profile (user_id matches seller_id in orders)
  SELECT * INTO vendor_record
  FROM profiles
  WHERE user_id = NEW.seller_id;

  IF vendor_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build notification payload (column names match the orders table)
  notification_payload := jsonb_build_object(
    'order_id', NEW.id,
    'buyer_name', NEW.customer_name,
    'buyer_phone', NEW.customer_phone,
    'total_amount', NEW.total,
    'items', NEW.items,
    'delivery_address', CONCAT(NEW.address, ', ', NEW.district, ', ', NEW.province),
    'vendor_name', COALESCE(vendor_record.farm_name, vendor_record.display_name),
    'vendor_email', COALESCE(vendor_record.notification_email, vendor_record.email),
    'line_notify_token', vendor_record.line_notify_token,
    'created_at', NEW.created_at
  );

  -- Use pg_net to call the Edge Function (if you have pg_net enabled)
  -- Uncomment below after enabling pg_net in Supabase Dashboard → Database → Extensions
  --
  -- PERFORM net.http_post(
  --   url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/notify-order'),
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
  --   ),
  --   body := notification_payload
  -- );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_order_notify ON orders;

CREATE TRIGGER on_new_order_notify
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_vendor_new_order();


-- ============================================================
-- 5. STORAGE: Ensure listing images bucket policies
-- ============================================================
-- The 'images' bucket already exists for profile photos.
-- These policies allow authenticated users to upload listing images too.

-- Allow authenticated users to upload to listings/ folder
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT 'Allow listing image uploads', 'images', 'INSERT',
  '(auth.role() = ''authenticated'' AND (storage.foldername(name))[1] = ''listings'')'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies WHERE name = 'Allow listing image uploads'
);

-- Note: If the above INSERT fails due to schema differences,
-- run this instead in the Supabase Dashboard → Storage → images bucket → Policies:
--
-- Policy name: Allow listing image uploads
-- Operation: INSERT
-- Target roles: authenticated
-- Policy: (storage.foldername(name))[1] = 'listings'


-- ============================================================
-- DONE! All migrations applied.
-- ============================================================
-- Next steps:
-- 1. Enable the pg_net extension (Database → Extensions → search "pg_net" → Enable)
-- 2. Deploy the Edge Function (see notify-order/ folder)
-- 3. Update seller.html to upload images to Storage instead of base64
-- ============================================================
