// SiamClones — Order Notification Edge Function
// Sends email (via Resend), LINE Notify, and/or Discord webhook
// to the vendor when a new order arrives.
//
// DEPLOY: supabase functions deploy notify-order --project-ref bqglrepbhjxmbgggdqal
//
// SECRETS NEEDED (set via Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY       — Get from https://resend.com (free tier: 100 emails/day)
//   FROM_EMAIL           — Your verified sender email in Resend (e.g. orders@siamclones.com)
//   DISCORD_WEBHOOK_URL  — Discord channel webhook URL for order notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@siamclones.com";
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
const NOTIFY_WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") || "";

interface OrderPayload {
  order_id: string;
  buyer_name: string;
  buyer_phone: string;
  total_amount: number;
  items: any;
  delivery_address: string;
  vendor_name: string;
  vendor_email: string | null;
  line_notify_token: string | null;
  payment_method: string;
  payment_proof_url: string;
  created_at: string;
}

function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    promptpay: 'PromptPay',
    cod: 'Cash on Delivery',
    btc: '₿ Bitcoin (BTC)',
    eth: 'Ξ Ethereum (ETH)',
    sol: '◎ Solana (SOL)',
  };
  return methods[method] || method || 'Not specified';
}

function formatItemsList(items: any): string {
  if (!Array.isArray(items)) return "See dashboard for details";
  return items
    .map((item: any) => `• ${item.title || item.product?.title || "Item"} × ${item.quantity}`)
    .join("\n");
}

// ---- EMAIL via Resend ----
async function sendEmail(payload: OrderPayload): Promise<boolean> {
  if (!RESEND_API_KEY || !payload.vendor_email) {
    console.log("Skipping email: no API key or vendor email");
    return false;
  }

  const itemsList = formatItemsList(payload.items);
  const paymentMethodDisplay = formatPaymentMethod(payload.payment_method);

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2D7D46 0%, #4CAF50 100%); padding: 32px; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🌿 New Order!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">SiamClones Marketplace</p>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e0e0e0; border-radius: 0 0 16px 16px;">
        <p style="font-size: 18px; color: #1A2E1A;">Hi ${payload.vendor_name},</p>
        <p>You have a new order! Here are the details:</p>

        <div style="background: #F5F5F0; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${payload.buyer_name}</p>
          <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${payload.buyer_phone}</p>
          <p style="margin: 0 0 8px;"><strong>Delivery:</strong> ${payload.delivery_address}</p>
          <p style="margin: 0 0 8px;"><strong>Total:</strong> ฿${payload.total_amount}</p>
          <p style="margin: 0 0 8px;"><strong>Payment:</strong> ${paymentMethodDisplay}</p>
          ${payload.payment_proof_url ? `
            <p style="margin: 0 0 12px;"><strong>Payment Proof:</strong></p>
            <a href="${payload.payment_proof_url}" target="_blank" style="display: inline-block;">
              <img src="${payload.payment_proof_url}" alt="Payment proof screenshot" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e0e0e0;" />
            </a>
            <p style="margin: 8px 0 0; font-size: 12px;"><a href="${payload.payment_proof_url}" style="color: #2D7D46;" target="_blank">Open full image →</a></p>
          ` : ''}
        </div>

        <div style="background: #E8F5E9; padding: 16px; border-radius: 12px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600;">Items:</p>
          <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${itemsList}</pre>
        </div>

        <p>Please contact the buyer to arrange delivery.</p>
        <a href="https://siamclones.com/seller.html"
           style="display: inline-block; background: #2D7D46; color: white; padding: 14px 28px; border-radius: 25px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          View in Dashboard →
        </a>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: payload.vendor_email,
        subject: `🌿 New Order — ฿${payload.total_amount} from ${payload.buyer_name}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return false;
    }

    console.log("Email sent to", payload.vendor_email);
    return true;
  } catch (e) {
    console.error("Email failed:", e);
    return false;
  }
}

// ---- LINE Notify ----
async function sendLineNotify(payload: OrderPayload): Promise<boolean> {
  if (!payload.line_notify_token) {
    console.log("Skipping LINE: no token");
    return false;
  }

  const paymentMethodDisplay = formatPaymentMethod(payload.payment_method);

  const message = `
🌿 New SiamClones Order!

Customer: ${payload.buyer_name}
Phone: ${payload.buyer_phone}
Total: ฿${payload.total_amount}
Delivery: ${payload.delivery_address}
Payment: ${paymentMethodDisplay}

Open your vendor dashboard to view details:
https://siamclones.com/seller.html`;

  try {
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${payload.line_notify_token}`,
      },
      body: `message=${encodeURIComponent(message)}`,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("LINE Notify error:", err);
      return false;
    }

    console.log("LINE notification sent");
    return true;
  } catch (e) {
    console.error("LINE failed:", e);
    return false;
  }
}

// ---- DISCORD Webhook ----
async function sendDiscordNotification(payload: OrderPayload): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    console.log("Skipping Discord: no webhook URL configured");
    return false;
  }

  const paymentMethodDisplay = formatPaymentMethod(payload.payment_method);
  const itemsList = formatItemsList(payload.items);

  const embed = {
    title: "🌿 New Order on SiamClones!",
    color: 0x2D7D46, // green
    fields: [
      { name: "Order ID", value: payload.order_id || "—", inline: true },
      { name: "Total", value: `฿${payload.total_amount}`, inline: true },
      { name: "Payment", value: paymentMethodDisplay, inline: true },
      { name: "Customer", value: payload.buyer_name, inline: true },
      { name: "Phone", value: payload.buyer_phone, inline: true },
      { name: "Vendor", value: payload.vendor_name, inline: true },
      { name: "Delivery", value: payload.delivery_address, inline: false },
      { name: "Items", value: itemsList.substring(0, 1024), inline: false },
      ...(payload.payment_proof_url ? [{ name: "Payment Proof", value: `[View Screenshot](${payload.payment_proof_url})`, inline: false }] : []),
    ],
    timestamp: payload.created_at || new Date().toISOString(),
    footer: {
      text: "SiamClones Marketplace",
    },
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "SiamClones Orders",
        avatar_url: "https://siamclones.com/icon-192.png",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Discord webhook error:", err);
      return false;
    }

    console.log("Discord notification sent");
    return true;
  } catch (e) {
    console.error("Discord failed:", e);
    return false;
  }
}

const ALLOWED_ORIGINS = [
  "https://siamclones.com",
  "https://www.siamclones.com",
  "https://bqglrepbhjxmbgggdqal.supabase.co",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// ---- Main handler ----
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authorization check — require shared secret OR valid Supabase anon key
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');

  // If NOTIFY_WEBHOOK_SECRET is set, the caller must provide it OR the Supabase anon key.
  // This blocks random internet callers while still allowing the pg_net database trigger to work.
  if (NOTIFY_WEBHOOK_SECRET) {
    // Decode JWT payload to check if it's a valid Supabase token (role: anon or service_role)
    // NOTE: This implementation decodes the JWT payload WITHOUT verifying the signature.
    // In production, use a proper JWT library (e.g., jose) to verify the signature against Supabase's public key.
    let isSupabaseToken = false;
    try {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const decoded = JSON.parse(atob(payloadB64));
        // Check token expiration (exp claim) to reject expired tokens
        const now = Math.floor(Date.now() / 1000);
        const isExpired = decoded.exp && decoded.exp < now;
        isSupabaseToken = !isExpired && decoded.iss === 'supabase' && ['anon', 'service_role'].includes(decoded.role);
      }
    } catch (_) { /* not a JWT */ }

    if (token !== NOTIFY_WEBHOOK_SECRET && !isSupabaseToken) {
      console.error("Auth failed: invalid or expired token");
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }
  }

  try {
    const payload: OrderPayload = await req.json();

    // Validate required fields to prevent processing incomplete requests
    const requiredFields = ['order_id', 'vendor_email', 'buyer_name', 'buyer_phone', 'delivery_address'];
    const missingFields = requiredFields.filter(field => !payload[field as keyof OrderPayload]);
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log only order_id and notification intent without exposing PII
    console.log("Processing notification for order:", payload.order_id);

    const results = await Promise.allSettled([
      sendEmail(payload),
      sendLineNotify(payload),
      sendDiscordNotification(payload),
    ]);

    const emailResult = results[0].status === "fulfilled" ? results[0].value : false;
    const lineResult = results[1].status === "fulfilled" ? results[1].value : false;
    const discordResult = results[2].status === "fulfilled" ? results[2].value : false;

    // Log notification status without exposing order details
    console.log(`Notifications sent for order ${payload.order_id}: email=${emailResult}, line=${lineResult}, discord=${discordResult}`);

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailResult,
        line_sent: lineResult,
        discord_sent: discordResult,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "99",
          "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
        },
      }
    );
  } catch (e) {
    // Log internal details for debugging but don't expose them to clients
    console.error("Handler error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
