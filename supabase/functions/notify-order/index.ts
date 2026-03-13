// SiamClones — Order Notification Edge Function
// Sends email (via Resend) and/or LINE Notify to the vendor when a new order arrives.
//
// DEPLOY: supabase functions deploy notify-order --project-ref bqglrepbhjxmbgggdqal
//
// SECRETS NEEDED (set via Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  — Get from https://resend.com (free tier: 100 emails/day)
//   FROM_EMAIL      — Your verified sender email in Resend (e.g. orders@siamclones.com)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@siamclones.com";

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
  created_at: string;
}

// ---- EMAIL via Resend ----
async function sendEmail(payload: OrderPayload): Promise<boolean> {
  if (!RESEND_API_KEY || !payload.vendor_email) {
    console.log("Skipping email: no API key or vendor email");
    return false;
  }

  const itemsList = Array.isArray(payload.items)
    ? payload.items
        .map((item: any) => `• ${item.title || item.product?.title || "Item"} × ${item.quantity}`)
        .join("\n")
    : "See dashboard for details";

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
          <p style="margin: 0;"><strong>Payment:</strong> Cash on Delivery</p>
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

  const message = `
🌿 New SiamClones Order!

Customer: ${payload.buyer_name}
Phone: ${payload.buyer_phone}
Total: ฿${payload.total_amount}
Delivery: ${payload.delivery_address}
Payment: Cash on Delivery

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

// ---- Main handler ----
serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload: OrderPayload = await req.json();
    console.log("Received order notification request:", payload.order_id);

    const results = await Promise.allSettled([
      sendEmail(payload),
      sendLineNotify(payload),
    ]);

    const emailResult = results[0].status === "fulfilled" ? results[0].value : false;
    const lineResult = results[1].status === "fulfilled" ? results[1].value : false;

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailResult,
        line_sent: lineResult,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Handler error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
