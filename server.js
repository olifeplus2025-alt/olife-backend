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

    if (!to) return;

    await transporter.sendMail({

      from: process.env.EMAIL_USER,

      to,

      subject,

      html

    });

    console.log("✅ Email Sent");

  } catch (err) {

    console.log(
      "❌ Email Error:",
      err.message
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

      status:
        "Pending Confirmation",

      shipmentStatus:
        "Pending",

      nimbusOrderId: "",

      nimbusResponse: null,

      createdAt:
        new Date().toISOString()

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
      savedOrder.orderId
    );

    // ============================================
    // CUSTOMER EMAIL
    // ============================================

    await sendEmail(

      order.email,

      "Order Placed Successfully",

      `

      <h2>
        Order Placed Successfully
      </h2>

      <p>
        Order ID:
        ${order.orderId}
      </p>

      <p>
        Total:
        ₹${order.total}
      </p>

      <p>
        You can cancel
        this order within
        5 minutes.
      </p>

      `

    );

    // ============================================
    // FAST RESPONSE
    // ============================================

    res.json({

      success: true,

      message:
        "Order placed successfully",

      order: savedOrder

    });

    // ============================================
    // AUTO SHIPMENT AFTER 5 MINUTES
    // ============================================

    setTimeout(async () => {

      try {

        const latestOrder =
          orders.find(

            o =>

              String(o.orderId) ===

              String(order.orderId)

          );

        // ORDER CANCELLED
        if (!latestOrder) {

          console.log(
            "❌ Order deleted before shipment"
          );

          return;

        }

        console.log(
          "🚚 Creating Shipment..."
        );

        const response =
          await fetch(

            "https://ship.nimbuspost.com/api/shipments/create",

            {

              method: "POST",

              headers: {

                "NP-API-KEY":
                  process.env.NIMBUS_API_KEY,

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify(payload)

            }

          );

        const data =
          await response.json();

        console.log(
          "🚚 Nimbus Response:",
          data
        );

        const nimbusOrderId =
          getNimbusOrderId(data);

        latestOrder.nimbusOrderId =
          nimbusOrderId;

        latestOrder.nimbusResponse =
          data;

        latestOrder.status =
          "Order Placed";

        latestOrder.shipmentStatus =
          data.status === true
            ? "Created"
            : "Failed";

        // ============================================
        // ADMIN EMAIL
        // ============================================

        await sendEmail(

          process.env.OLIFE_ADMIN_EMAIL,

          "🚚 New Order Booked",

          `

          <h2>
            New Order Booked
          </h2>

          <p>
            Customer:
            ${order.name}
          </p>

          <p>
            Phone:
            ${order.phone}
          </p>

          <p>
            Total:
            ₹${order.total}
          </p>

          <p>
            Order ID:
            ${order.orderId}
          </p>

          <p>
            Nimbus Order ID:
            ${nimbusOrderId}
          </p>

          `

        );

        console.log(
          "✅ Shipment Created"
        );

      } catch (err) {

        console.log(
          "❌ Shipment Error:",
          err.message
        );

      }

    }, 300000);

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
      "❌ Order deleted"
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
// START SERVER
// ============================================

app.listen(PORT, () => {

  console.log(
    "🚀 Server running on port " + PORT
  );
});