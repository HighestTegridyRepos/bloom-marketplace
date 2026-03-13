# SiamClones — Deploy Guide

## What Changed

### Frontend (index.html)
- **PromptPay QR payment** — Buyers can now choose between Cash on Delivery and PromptPay at checkout. If the vendor has a PromptPay ID, a scannable QR code appears on the order confirmation page.
- **PWA support** — manifest.json + service worker enable "Add to Home Screen" on mobile, with offline caching of static assets.
- **useIsMobile consistency** — Aligned threshold to `<= 768` across both files.

### Frontend (seller.html)
- **Listing images now upload to Supabase Storage** instead of base64 encoding. Images are served via CDN, load faster, and are ~33% smaller.
- **Notification settings added** to the vendor profile setup (Step 3). Vendors can set a notification email, LINE Notify token, and PromptPay ID.
- **PWA support** — manifest link and service worker registration added.

### New files
- **manifest.json** — PWA web app manifest (name, icons, theme color)
- **sw.js** — Service worker (cache-first for static, network-first for API)
- **icon-192.png / icon-512.png** — PWA icon PNGs generated from favicon.svg

### Backend (new files)
- **supabase-setup.sql** — SQL migration that adds notification columns, promptpay_id, payment_method, rate limiting triggers, and a vendor notification trigger.
- **supabase/functions/notify-order/index.ts** — Edge Function that sends email (via Resend) and LINE Notify messages when a new order arrives.

---

## Step-by-Step Deploy

### 1. Run the SQL Migration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/bqglrepbhjxmbgggdqal)
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase-setup.sql` in a text editor, copy **all** the contents
5. Paste into the SQL Editor and click **Run**
6. You should see "Success. No rows returned" — that means it worked

### 2. Create a Storage Policy for Listing Images
The SQL tries to create this automatically, but if it fails:
1. In Supabase Dashboard, go to **Storage** → click the **images** bucket
2. Click **Policies** tab
3. Click **New Policy** → **For full customization**
4. Set:
   - Policy name: `Allow listing image uploads`
   - Allowed operation: **INSERT**
   - Target roles: `authenticated`
   - WITH CHECK expression: `(storage.foldername(name))[1] = 'listings'`
5. Click **Save**

### 3. Enable pg_net Extension (for automatic notifications)
1. In Supabase Dashboard, go to **Database** → **Extensions**
2. Search for `pg_net`
3. Click **Enable**
4. Then go back to **SQL Editor** and run this:
```sql
-- Uncomment and run the pg_net call inside notify_vendor_new_order()
CREATE OR REPLACE FUNCTION notify_vendor_new_order()
RETURNS TRIGGER AS $$
DECLARE
  vendor_record RECORD;
  notification_payload JSONB;
BEGIN
  SELECT * INTO vendor_record
  FROM profiles
  WHERE user_id = NEW.seller_id;

  IF vendor_record IS NULL THEN
    RETURN NEW;
  END IF;

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

  PERFORM net.http_post(
    url := 'https://bqglrepbhjxmbgggdqal.supabase.co/functions/v1/notify-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := notification_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
**Important:** Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key from **Settings** → **API** → **service_role** (the secret one, not the anon key).

### 4. Deploy the Edge Function
The Edge Function requires the Supabase CLI. If you don't have it:
- **Alternative:** Use the Supabase Dashboard → **Edge Functions** → **New Function** → paste the code from `supabase/functions/notify-order/index.ts`

If you have the CLI:
```bash
supabase functions deploy notify-order --project-ref bqglrepbhjxmbgggdqal
```

### 5. Set Edge Function Secrets
In Supabase Dashboard → **Edge Functions** → **notify-order** → **Secrets**:
- `RESEND_API_KEY` — Get from [resend.com](https://resend.com) (free: 100 emails/day)
- `FROM_EMAIL` — Your verified sender email (e.g. `orders@siamclones.com`, or use Resend's default)

### 6. Push Frontend to GitHub
1. Go to [github.com/TegridyRepoRanch/bloom-marketplace](https://github.com/TegridyRepoRanch/bloom-marketplace)
2. Drag the updated files from `bloom-update/` into the GitHub web UI
3. The key files to upload: `index.html`, `seller.html`, `favicon.svg`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
4. Vercel will auto-deploy within ~60 seconds

---

## What Each Rate Limit Does
- **Orders:** Max 10 orders per hour from the same phone number
- **Listings:** Max 20 total listings per vendor, max 5 new listings per hour

## LINE Notify Setup (for vendors)
1. Go to [notify-bot.line.me](https://notify-bot.line.me/)
2. Log in with LINE account
3. Click "Generate token"
4. Choose a chat room to receive notifications
5. Copy the token and paste it in the vendor profile settings
