import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the auth token from the request to identify the user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for data operations
    const admin = createClient(supabaseUrl, serviceKey);

    // Get user's business
    const { data: profile } = await admin
      .from("profiles")
      .select("business_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "No business profile found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = profile.business_id;

    // Check if demo data already exists (idempotency: check for demo products by SKU)
    const { data: existing } = await admin
      .from("products")
      .select("id")
      .eq("business_id", businessId)
      .eq("sku", "DEMO-IP15")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "Demo data already loaded for this business", alreadySeeded: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ SEED PRODUCTS ============
    const products = [
      { name: "iPhone 15", sku: "DEMO-IP15", unit: "piece", cost_price: 280000, selling_price: 350000, quantity_on_hand: 10, low_stock_threshold: 3 },
      { name: "Samsung A55", sku: "DEMO-SMA55", unit: "piece", cost_price: 120000, selling_price: 150000, quantity_on_hand: 8, low_stock_threshold: 3 },
      { name: "AirPods Pro", sku: "DEMO-APP", unit: "piece", cost_price: 45000, selling_price: 65000, quantity_on_hand: 15, low_stock_threshold: 5 },
      { name: "USB-C Cable", sku: "DEMO-USBC", unit: "piece", cost_price: 500, selling_price: 1200, quantity_on_hand: 2, low_stock_threshold: 10 },
      { name: "Power Bank 20000mAh", sku: "DEMO-PB20", unit: "piece", cost_price: 3000, selling_price: 5500, quantity_on_hand: 20, low_stock_threshold: 5 },
    ];

    const productRecords: { id: string; name: string; cost_price: number; selling_price: number; quantity_on_hand: number }[] = [];
    for (const p of products) {
      const { data, error } = await admin.from("products").insert({
        business_id: businessId,
        ...p,
        is_active: true,
      }).select("id, name, cost_price, selling_price, quantity_on_hand").single();
      if (!error && data) productRecords.push(data);
    }

    // ============ SEED CUSTOMERS ============
    const customers = [
      { name: "Ahmed Khan", email: "ahmed@example.com", phone: "0300-1234567", address: "Gulberg, Lahore" },
      { name: "Ali Raza", email: "ali@example.com", phone: "0321-9876543", address: "F-8, Islamabad" },
      { name: "Sara Electronics", email: "sara@electronics.com", phone: "0345-5555555", address: "Saddar, Karachi" },
    ];

    const customerRecords: { id: string; name: string }[] = [];
    for (const c of customers) {
      const { data } = await admin.from("customers").insert({ business_id: businessId, ...c }).select("id, name").single();
      if (data) customerRecords.push(data);
    }

    // ============ SEED SUPPLIERS ============
    const suppliers = [
      { name: "Tech Distributors", email: "sales@techdist.com", phone: "042-1112222", address: "Industrial Area, Lahore" },
      { name: "Mobile Hub", email: "info@mobilehub.com", phone: "021-3334444", address: "SITE Area, Karachi" },
    ];

    const supplierRecords: { id: string; name: string }[] = [];
    for (const s of suppliers) {
      const { data } = await admin.from("suppliers").insert({ business_id: businessId, ...s }).select("id, name").single();
      if (data) supplierRecords.push(data);
    }

    // ============ SEED SALES (via direct insert to keep it simple) ============
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const lastWeek = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

    const iphone = productRecords.find((p) => p.name === "iPhone 15");
    const samsung = productRecords.find((p) => p.name === "Samsung A55");
    const airpods = productRecords.find((p) => p.name === "AirPods Pro");
    const powerbank = productRecords.find((p) => p.name === "Power Bank 20000mAh");
    const ahmed = customerRecords.find((c) => c.name === "Ahmed Khan");
    const ali = customerRecords.find((c) => c.name === "Ali Raza");
    const sara = customerRecords.find((c) => c.name === "Sara Electronics");
    const techDist = supplierRecords.find((s) => s.name === "Tech Distributors");
    const mobileHub = supplierRecords.find((s) => s.name === "Mobile Hub");

    // Sale 1: 2 iPhones to Ahmed, partial payment
    if (iphone && ahmed) {
      const subtotal = 2 * 350000;
      const total = subtotal;
      const paid = 200000;
      const { data: txn } = await admin.from("transactions").insert({
        business_id: businessId,
        transaction_number: "SALE-DEMO-001",
        transaction_type: "sale",
        customer_id: ahmed.id,
        status: "completed",
        subtotal, total_amount: total, amount_paid: paid, amount_due: total - paid,
        occurred_at: lastWeek.toISOString(),
      }).select("id").single();
      if (txn) {
        await admin.from("transaction_items").insert({
          transaction_id: txn.id, product_id: iphone.id, description: "iPhone 15",
          quantity: 2, unit_price: 350000, unit_cost_snapshot: 280000, line_total: 700000,
        });
        // Update inventory
        await admin.from("products").update({ quantity_on_hand: iphone.quantity_on_hand - 2 }).eq("id", iphone.id);
        await admin.from("inventory_movements").insert({
          business_id: businessId, product_id: iphone.id, movement_type: "sale",
          quantity_delta: -2, notes: "Demo sale to Ahmed Khan",
        });
        if (paid > 0) {
          await admin.from("payments").insert({
            business_id: businessId, transaction_id: txn.id, customer_id: ahmed.id,
            payment_method: "cash", amount: paid, status: "completed", paid_at: lastWeek.toISOString(),
          });
        }
      }
    }

    // Sale 2: 1 Samsung to Ali, full payment
    if (samsung && ali) {
      const total = 150000;
      const { data: txn } = await admin.from("transactions").insert({
        business_id: businessId,
        transaction_number: "SALE-DEMO-002",
        transaction_type: "sale",
        customer_id: ali.id,
        status: "completed",
        subtotal: total, total_amount: total, amount_paid: total, amount_due: 0,
        occurred_at: yesterday.toISOString(),
      }).select("id").single();
      if (txn) {
        await admin.from("transaction_items").insert({
          transaction_id: txn.id, product_id: samsung.id, description: "Samsung A55",
          quantity: 1, unit_price: 150000, unit_cost_snapshot: 120000, line_total: 150000,
        });
        await admin.from("products").update({ quantity_on_hand: samsung.quantity_on_hand - 1 }).eq("id", samsung.id);
        await admin.from("inventory_movements").insert({
          business_id: businessId, product_id: samsung.id, movement_type: "sale",
          quantity_delta: -1, notes: "Demo sale to Ali Raza",
        });
        await admin.from("payments").insert({
          business_id: businessId, transaction_id: txn.id, customer_id: ali.id,
          payment_method: "bank", amount: total, status: "completed", paid_at: yesterday.toISOString(),
        });
      }
    }

    // Sale 3: 3 AirPods to Sara, credit
    if (airpods && sara) {
      const total = 3 * 65000;
      const { data: txn } = await admin.from("transactions").insert({
        business_id: businessId,
        transaction_number: "SALE-DEMO-003",
        transaction_type: "sale",
        customer_id: sara.id,
        status: "completed",
        subtotal: total, total_amount: total, amount_paid: 0, amount_due: total,
        occurred_at: twoWeeksAgo.toISOString(),
      }).select("id").single();
      if (txn) {
        await admin.from("transaction_items").insert({
          transaction_id: txn.id, product_id: airpods.id, description: "AirPods Pro",
          quantity: 3, unit_price: 65000, unit_cost_snapshot: 45000, line_total: 195000,
        });
        await admin.from("products").update({ quantity_on_hand: airpods.quantity_on_hand - 3 }).eq("id", airpods.id);
        await admin.from("inventory_movements").insert({
          business_id: businessId, product_id: airpods.id, movement_type: "sale",
          quantity_delta: -3, notes: "Demo credit sale to Sara Electronics",
        });
      }
    }

    // ============ SEED PURCHASES ============
    // Purchase 1: 10 iPhones from Tech Distributors, partial payment
    if (iphone && techDist) {
      const total = 10 * 280000;
      const paid = 1400000;
      const { data: txn } = await admin.from("transactions").insert({
        business_id: businessId,
        transaction_number: "PUR-DEMO-001",
        transaction_type: "purchase",
        supplier_id: techDist.id,
        status: "completed",
        subtotal: total, total_amount: total, amount_paid: paid, amount_due: total - paid,
        occurred_at: twoWeeksAgo.toISOString(),
      }).select("id").single();
      if (txn) {
        await admin.from("transaction_items").insert({
          transaction_id: txn.id, product_id: iphone.id, description: "iPhone 15",
          quantity: 10, unit_price: 280000, unit_cost_snapshot: 280000, line_total: total,
        });
        await admin.from("inventory_movements").insert({
          business_id: businessId, product_id: iphone.id, movement_type: "purchase",
          quantity_delta: 10, notes: "Demo purchase from Tech Distributors",
        });
        if (paid > 0) {
          await admin.from("payments").insert({
            business_id: businessId, transaction_id: txn.id, supplier_id: techDist.id,
            payment_method: "bank", amount: paid, status: "completed", paid_at: twoWeeksAgo.toISOString(),
          });
        }
      }
    }

    // Purchase 2: 5 Power Banks from Mobile Hub, full payment
    if (powerbank && mobileHub) {
      const total = 5 * 3000;
      const { data: txn } = await admin.from("transactions").insert({
        business_id: businessId,
        transaction_number: "PUR-DEMO-002",
        transaction_type: "purchase",
        supplier_id: mobileHub.id,
        status: "completed",
        subtotal: total, total_amount: total, amount_paid: total, amount_due: 0,
        occurred_at: lastWeek.toISOString(),
      }).select("id").single();
      if (txn) {
        await admin.from("transaction_items").insert({
          transaction_id: txn.id, product_id: powerbank.id, description: "Power Bank 20000mAh",
          quantity: 5, unit_price: 3000, unit_cost_snapshot: 3000, line_total: total,
        });
        await admin.from("inventory_movements").insert({
          business_id: businessId, product_id: powerbank.id, movement_type: "purchase",
          quantity_delta: 5, notes: "Demo purchase from Mobile Hub",
        });
        await admin.from("payments").insert({
          business_id: businessId, transaction_id: txn.id, supplier_id: mobileHub.id,
          payment_method: "cash", amount: total, status: "completed", paid_at: lastWeek.toISOString(),
        });
      }
    }

    // ============ SEED EXPENSE ============
    await admin.from("transactions").insert({
      business_id: businessId,
      transaction_number: "EXP-DEMO-001",
      transaction_type: "expense",
      status: "completed",
      subtotal: 25000, total_amount: 25000, amount_paid: 25000, amount_due: 0,
      occurred_at: yesterday.toISOString(),
      notes: "Demo: Shop rent for the month",
    });
    await admin.from("transaction_items").insert({
      transaction_id: (await admin.from("transactions").select("id").eq("transaction_number", "EXP-DEMO-001").maybeSingle()).data?.id,
      description: "Monthly shop rent", quantity: 1, unit_price: 25000, unit_cost_snapshot: 25000, line_total: 25000,
    });

    // ============ SEED INVOICE ============
    if (sara && airpods) {
      const invTotal = 195000;
      const { data: inv } = await admin.from("invoices").insert({
        business_id: businessId,
        customer_id: sara.id,
        invoice_number: "INV-DEMO-001",
        status: "issued",
        subtotal: invTotal, tax_amount: 0, discount_amount: 0,
        total_amount: invTotal, amount_paid: 0, amount_due: invTotal,
        issue_date: twoWeeksAgo.toISOString().slice(0, 10),
        due_date: new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
      }).select("id").single();
      if (inv) {
        await admin.from("invoice_items").insert({
          invoice_id: inv.id, product_id: airpods.id, description: "AirPods Pro",
          quantity: 3, unit_price: 65000, line_total: 195000,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Demo data loaded successfully",
        products: productRecords.length,
        customers: customerRecords.length,
        suppliers: supplierRecords.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
