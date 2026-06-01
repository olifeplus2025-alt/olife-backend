const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
const nodemailer = require("nodemailer");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

// ============================================
// MEMORY DATABASE
// ============================================

let orders = [];

// ============================================
// EMAIL SETUP
// ============================================

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {

    user: process.env.EMAIL_USER,

    pass: process.env.EMAIL_PASS

  }

});

// ============================================
// SEND EMAIL
// ============================================

async function sendEmail(to, subject, html) {

  try {

    if (!to) {
      console.log("⚠️ No email recipient provided");
      return;
    }

    console.log(`📧 Sending email to ${to}...`);

    const result = await transporter.sendMail({

      from: process.env.EMAIL_USER,

      to,

      subject,

      html

    });

    console.log("✅ Email Sent successfully:", result.messageId);

  } catch (err) {

    console.error(
      "❌ Email Error:",
      err.message,
      err.response
    );

  }

}

// ============================================
// GET NIMBUS ORDER ID
// ============================================

function getNimbusOrderId(data) {

  return (

    data?.data?.order_id ||

    data?.order_id ||

    data?.data?.shipment_id ||

    data?.shipment_id ||

    ""

  );

}

// ============================================
// CREATE SHIPMENT (FUNCTION)
// ============================================

async function createShipmentForOrder(order, payload) {

  try {

    const latestOrder = orders.find(
      o => String(o.orderId) === String(order.orderId)
    );

    if (!latestOrder) {
      console.log("❌ Order not found or deleted:", order.orderId);
      return;
    }

    // If already created, skip
    if (latestOrder.shipmentStatus === "Created") {
      console.log("⏭️  Shipment already created for:", order.orderId);
      return;
    }

    console.log("🚚 [SHIPMENT PROCESSOR] Creating Shipment for Order:", order.orderId);

    if (!process.env.NIMBUS_API_KEY) {
      console.error("❌ NIMBUS_API_KEY not set in .env");
      latestOrder.shipmentStatus = "Error";
      latestOrder.shipmentError = "NIMBUS_API_KEY missing";
      return;
    }

    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(
      "https://ship.nimbuspost.com/api/shipments/create",
      {
        method: "POST",
        headers: {
          "NP-API-KEY": process.env.NIMBUS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    console.log("📥 Nimbus Response Status:", response.status);

    const data = await response.json();

    console.log(
      "🚚 Nimbus Response Data:",
      JSON.stringify(data, null, 2)
    );

    const nimbusOrderId = getNimbusOrderId(data);

    latestOrder.nimbusOrderId = nimbusOrderId;
    latestOrder.nimbusResponse = data;
    latestOrder.status = "Order Placed";
    latestOrder.shipmentStatus = data.status === true ? "Created" : "Failed";
    latestOrder.shipmentCreatedAt = new Date().toISOString();

    console.log(
      "✅ Shipment Created with ID:",
      nimbusOrderId
    );

  } catch (err) {

    console.error(
      "❌ Shipment Error:",
      err.message,
      err.stack
    );

    const latestOrder = orders.find(
      o => String(o.orderId) === String(order.orderId)
    );

    if (latestOrder) {
      latestOrder.shipmentStatus = "Error";
      latestOrder.shipmentError = err.message;
    }

  }

}

// ============================================
// SHIPMENT PROCESSOR (EVERY 1 MINUTE)
// ============================================

setInterval(() => {

  console.log("\n⏰ [SHIPMENT PROCESSOR] Checking for pending shipments...");

  const now = new Date().getTime();

  orders.forEach(order => {

    // If shipment already created, skip
    if (order.shipmentStatus === "Created") return;

    // If order was cancelled, skip
    if (!order.orderId) return;

    // Check if 5 minutes passed (300000ms)
    const createdTime = new Date(order.createdAt).getTime();
    const timeDiff = now - createdTime;

    console.log(`📋 Order: ${order.orderId} | Time passed: ${Math.floor(timeDiff / 1000)}s | Status: ${order.shipmentStatus}`);

    if (timeDiff >= 300000) {  // 5 मिनट

      console.log(`\n🚀 CREATING SHIPMENT for Order ${order.orderId} (waited ${Math.floor(timeDiff / 1000)}s)`);

      // Rebuild payload for this order
      const items = Array.isArray(order.items) ? order.items : [];

      const payload = {

        consignee: {
          name: order.name || order.customerName || "Customer",
          address: order.address || "",
          address_2: order.address_2 || "",
          city: order.city || "",
          state: order.state || "",
          pincode: String(order.pincode || ""),
          phone: String(order.phone || order.phoneNumber || "")
        },

        order: {
          order_number: order.orderId || "ORD" + Date.now(),
          shipping_charges: Number(order.shipping || 0),
          discount: Number(order.discount || 0),
          cod_charges: Number(order.codCharge || 0),
          payment_type: (order.paymentMethod || order.paymentType) === "COD" ? "cod" : "prepaid",
          total: Number(order.total || 0),
          package_weight: Number(order.package_weight || 300),
          package_length: Number(order.package_length || 10),
          package_height: Number(order.package_height || 10),
          package_breadth: Number(order.package_breadth || 10)
        },

        order_items: items.map((item, index) => ({
          name: item.name || "Product",
          qty: String(item.quantity || item.qty || 1),
          price: String(item.price || 0),
          sku: item.id || item.sku || "SKU" + (index + 1)
        })),

        pickup_warehouse_id: process.env.PICKUP_WAREHOUSE_ID,
        rto_warehouse_id: process.env.RTO_WAREHOUSE_ID || process.env.PICKUP_WAREHOUSE_ID

      };

      createShipmentForOrder(order, payload);

    }

  });

}, 60000);  // हर 1 मिनट चेक करो

// ============================================
// CREATE ORDER
// ============================================

app.post("/create-shipment", async (req, res) => {

  try {

    const order = req.body || {};

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    // ============================================
    // NIMBUS PAYLOAD
    // ============================================

    const payload = {

      consignee: {

        name:
          order.name ||
          order.customerName ||
          "Customer",

        address:
          order.address || "",

        address_2:
          order.address_2 || "",

        city:
          order.city || "",

        state:
          order.state || "",

        pincode:
          String(order.pincode || ""),

        phone:
          String(
            order.phone ||
            order.phoneNumber ||
            ""
          )

      },

      order: {

        order_number:
          order.orderId ||
          "ORD" + Date.now(),

        shipping_charges:
          Number(order.shipping || 0),

        discount:
          Number(order.discount || 0),

        cod_charges:
          Number(order.codCharge || 0),

        payment_type:

          (
            order.paymentMethod ||
            order.paymentType
          ) === "COD"

            ? "cod"

            : "prepaid",

        total:
          Number(order.total || 0),

        package_weight:
          Number(order.package_weight || 300),

        package_length:
          Number(order.package_length || 10),

        package_height:
          Number(order.package_height || 10),

        package_breadth:
          Number(order.package_breadth || 10)

      },

      order_items:
        items.map((item, index) => ({

          name:
            item.name || "Product",

          qty:
            String(
              item.quantity ||
              item.qty ||
              1
            ),

          price:
            String(item.price || 0),

          sku:
            item.id ||
            item.sku ||
            "SKU" + (index + 1)

        })),

      pickup_warehouse_id:
        process.env.PICKUP_WAREHOUSE_ID,

      rto_warehouse_id:

        process.env.RTO_WAREHOUSE_ID ||

        process.env.PICKUP_WAREHOUSE_ID

    };

    console.log(
      "📦 Payload Ready"
    );

    // ============================================
    // SAVE ORDER
    // ============================================

    const savedOrder = {
      ...order,
      status: "Order Placed",
      shipmentStatus: "Processing",
      nimbusOrderId: "",
      nimbusResponse: null,
      createdAt: new Date().toISOString(),
      shipmentScheduledFor: new Date(Date.now() + 300000).toISOString()
    };

    // REMOVE DUPLICATE
    orders = orders.filter(

      o =>

        String(o.orderId || "") !==

        String(savedOrder.orderId || "")

    );

    // SAVE ORDER
    orders.unshift(savedOrder);

    console.log(
      "📦 ORDER SAVED:",
      savedOrder.orderId,
      "| Shipment scheduled for:", savedOrder.shipmentScheduledFor
    );

    // ============================================
    // CUSTOMER EMAIL
    // ============================================

    const customerEmailTemplate = `
   <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:30px;">
     <div style="max-width:650px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);">

       <div style="background:#0B3D91;padding:25px;text-align:center;">
         <h1 style="color:#fff;margin:0;">✅ Order Placed Successfully</h1>
         <p style="color:#dbe8ff;margin-top:8px;">Thank you for your order!</p>
       </div>

       <div style="padding:30px;">
         <h2 style="color:#222;">Order Details</h2>

         <table style="width:100%;border-collapse:collapse;">
           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Order ID</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.orderId || "-"}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Total Amount</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">₹${order.total || 0}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Payment Method</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.paymentMethod || "-"}</td>
           </tr>
         </table>

         <div style="margin-top:20px;padding:15px;background:#f8fafc;border-left:4px solid #0B3D91;">
           <strong>Shipping Address</strong><br>
           ${order.address || "-"}<br>
           ${order.city || ""}, ${order.state || ""} - ${order.pincode || ""}
         </div>
       </div>

       <div style="background:#f8f9fa;padding:18px;text-align:center;color:#666;">
         © 2026 OlifePlus | Order Management System
       </div>

     </div>
   </div>
   `;

    const adminEmailTemplate = `
   <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:30px;">
     <div style="max-width:650px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);">

       <div style="background:#0B3D91;padding:25px;text-align:center;">
         <h1 style="color:#fff;margin:0;">🛒 New Order Received</h1>
         <p style="color:#dbe8ff;margin-top:8px;">OlifePlus Admin Notification</p>
       </div>

       <div style="padding:30px;">
         <h2 style="color:#222;">Customer Details</h2>

         <table style="width:100%;border-collapse:collapse;">
           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Name</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.name || "-"}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Email</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.email || "-"}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Phone</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.phone || "-"}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Order ID</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.orderId || "-"}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Total Amount</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">₹${order.total || 0}</td>
           </tr>

           <tr>
             <td style="padding:10px;border-bottom:1px solid #eee;"><strong>Payment Method</strong></td>
             <td style="padding:10px;border-bottom:1px solid #eee;">${order.paymentMethod || "-"}</td>
           </tr>
         </table>

         <div style="margin-top:20px;padding:15px;background:#f8fafc;border-left:4px solid #0B3D91;">
           <strong>Shipping Address</strong><br>
           ${order.address || "-"}<br>
           ${order.city || ""}, ${order.state || ""} - ${order.pincode || ""}
         </div>
       </div>

       <div style="background:#f8f9fa;padding:18px;text-align:center;color:#666;">
         © 2026 OlifePlus | Order Management System
       </div>

     </div>
   </div>
   `;

    // Response immediately
    res.json({
      success: true,
      order: savedOrder
    });

    // Send emails in background
    sendEmail(
      order.email,
      "Order Placed Successfully",
      customerEmailTemplate
    );

    sendEmail(
      process.env.OLIFE_ADMIN_EMAIL,
      `🛒 New Order #${order.orderId}`,
      adminEmailTemplate
    );

  } catch (err) {

    console.error(
      "❌ Create Error:",
      err.message
    );

    res.status(500).json({

      success: false,

      message:
        "Shipment create failed",

      error:
        err.message

    });

  }

});

// ============================================
// CANCEL ORDER
// ============================================

app.post("/cancel-order", async (req, res) => {

  try {

    const { orderId } = req.body;

    if (!orderId) {

      return res.json({

        success: false,

        message:
          "Order ID missing"

      });

    }

    // DELETE ORDER
    orders = orders.filter(

      order =>

        String(order.orderId) !==

        String(orderId)

    );

    console.log(
      "❌ Order deleted:",
      orderId
    );

    return res.json({

      success: true,

      message:
        "Order cancelled successfully"

    });

  } catch (err) {

    console.error(
      "❌ Cancel Error:",
      err.message
    );

    return res.status(500).json({

      success: false,

      message:
        err.message

    });

  }

});

// ============================================
// GET ALL ORDERS
// ============================================

app.get("/orders", (req, res) => {

  res.json(orders);

});

// ============================================
// GET SINGLE ORDER
// ============================================

app.get("/get-order/:id", (req, res) => {

  const order = orders.find(

    o =>

      String(o.orderId || "") ===
      String(req.params.id)

      ||

      String(o.nimbusOrderId || "") ===
      String(req.params.id)

  );

  if (!order) {

    return res.json({

      success: false,

      message:
        "Order not found"

    });

  }

  res.json({

    success: true,

    order

  });

});

// ============================================
// TEST ROUTE
// ============================================

app.get("/test", (req, res) => {

  res.json({

    success: true,

    message:
      "Server working"

  });

});

// ============================================
// TEST EMAIL ROUTE
// ============================================

app.get("/test-email", async (req, res) => {

  try {

    const testEmail = `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:30px;">
        <div style="max-width:650px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);">
          <div style="background:#0B3D91;padding:25px;text-align:center;">
            <h1 style="color:#fff;margin:0;">✅ Test Email</h1>
            <p style="color:#dbe8ff;margin-top:8px;">This is a test email from OlifePlus Server</p>
          </div>
          <div style="padding:30px;">
            <p>If you received this email, the email system is working correctly!</p>
          </div>
          <div style="background:#f8f9fa;padding:18px;text-align:center;color:#666;">
            © 2026 OlifePlus | Test Email
          </div>
        </div>
      </div>
    `;

    await sendEmail(
      process.env.OLIFE_ADMIN_EMAIL,
      "🧪 Test Email from OlifePlus Server",
      testEmail
    );

    res.json({

      success: true,

      message: "Test email sent!"

    });

  } catch (err) {

    res.status(500).json({

      success: false,

      message: err.message

    });

  }

});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {

  console.log(
    "🚀 Server running on port " + PORT
  );

  console.log("📋 Shipment Processor started - checking every 1 minute");

});