
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

let orders = [];

// ======================================
// EMAIL SETUP
// ======================================

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {

    user: process.env.EMAIL_USER,

    pass: process.env.EMAIL_PASS

  }

});

// ======================================
// SEND EMAIL
// ======================================

async function sendEmail(to, subject, html) {

  try {

    await transporter.sendMail({

      from: process.env.EMAIL_USER,

      to,

      subject,

      html

    });

    console.log("✅ Email Sent");

  } catch (err) {

    console.log("❌ Email Error:", err.message);

  }

}

// ======================================
// CREATE ORDER
// ======================================

app.post("/create-shipment", async (req, res) => {

  try {

    const order = req.body || {};

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    // ======================================
    // NIMBUS PAYLOAD
    // ======================================

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

    // ======================================
    // SAVE ORDER ONLY
    // ======================================

    const savedOrder = {

      ...order,

      status:
        "Pending Confirmation",

      shipmentStatus:
        "Pending",

      nimbusOrderId: "",

      awb: "",

      createdAt:
        new Date().toISOString(),

      autoShipAt:
        Date.now() + 60000,

      cancelledAt: null

    };

    // REMOVE OLD DUPLICATE
    orders = orders.filter(
      o =>

        String(o.orderId || "") !==

        String(savedOrder.orderId || "")

    );

    // SAVE ORDER
    orders.unshift(savedOrder);

    console.log("📦 ORDER SAVED:", savedOrder.orderId);

    // ======================================
    // SEND CUSTOMER EMAIL
    // ======================================

    await sendEmail(

      order.email,

      "Order Placed Successfully",

      `
      <h2>Order Placed Successfully</h2>

      <p>
        Your order has been placed successfully.
      </p>

      <p>
        Order ID: ${order.orderId}
      </p>

      <p>
        Total: ₹${order.total}
      </p>

      <p>
        You can cancel this order within 24 hours.
      </p>
      `

    );

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    res.json({

      success: true,

      message:
        "Order placed successfully",

      order: savedOrder

    });

    // ======================================
    // AUTO SHIPMENT AFTER 24 HOURS
    // ======================================

    setTimeout(async () => {

      try {

        const latestOrder =
          orders.find(

            o =>

              String(o.orderId) ===

              String(order.orderId)

          );

        // STOP IF CANCELLED
        if (

          !latestOrder ||

          latestOrder.status ===
            "Cancelled"

        ) {

          console.log(
            "❌ Shipment skipped"
          );

          return;

        }

        console.log(
          "🚚 Creating Shipment..."
        );

        const response = await fetch(

          "https://ship.nimbuspost.com/api/shipments/create",

          {

            method: "POST",

            headers: {

              "NP-API-KEY":
                process.env
                  .NIMBUS_API_KEY,

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
          "🚚 FULL NIMBUS RESPONSE:",
          JSON.stringify(data, null, 2)
        );

        const nimbusOrderId =

          data?.data?.order_id ||

          data?.order_id ||

          data?.data?.shipment_id ||

          "";

        const awb =

          data?.data?.awb_number ||

          data?.awb_number ||

          "";

        console.log(
          "🔥 SAVED NIMBUS ID:",
          nimbusOrderId
        );

        console.log(
          "🔥 SAVED AWB:",
          awb
        );

        // UPDATE ORDER
        orders = orders.map(o => {

          if (
            String(o.orderId) ===
            String(order.orderId)
          ) {

            return {

              ...o,

              nimbusOrderId,

              awb,

              nimbusResponse:
                data,

              status:
                "Order Placed",

              shipmentStatus:
                "Created"

            };

          }

          return o;

        });

        console.log("✅ Shipment Created");

      } catch (e) {

        console.log(
          "❌ Shipment Error:",
          e.message
        );

      }

    }, 60000);

  } catch (err) {

    console.error(
      "❌ Create Error:",
      err.message
    );

    res.status(500).json({

      success: false,

      message:
        "Order create failed",

      error:
        err.message

    });

  }

});

// ======================================
// CANCEL ORDER
// ======================================

app.post("/cancel-order", async (req, res) => {

  try {

    const {
      orderId
    } = req.body;

    const latestOrder =
      orders.find(

        o =>

          String(o.orderId) ===

          String(orderId)

      );

    if (!latestOrder) {

      return res.json({

        success: false,

        message:
          "Order not found"

      });

    }

    // ======================================
    // LOCAL CANCEL
    // ======================================

    latestOrder.status =
      "Cancelled";

    latestOrder.shipmentStatus =
      "Cancelled";

    latestOrder.cancelledAt =
      new Date().toISOString();

    // ======================================
    // SEND CANCEL EMAIL
    // ======================================

    await sendEmail(

      latestOrder.email,

      "Order Cancelled",

      `
      <h2>Order Cancelled Successfully</h2>

      <p>
        Your order has been cancelled.
      </p>

      <p>
        Order ID:
        ${latestOrder.orderId}
      </p>

      <p>
        Refund (if applicable)
        will be processed
        within 5-7 business days.
      </p>
      `

    );

    // ======================================
    // IF SHIPMENT NOT CREATED
    // ======================================

    if (
      !latestOrder.awb
    ) {

      return res.json({

        success: true,

        message:
          "Order cancelled successfully before shipment"

      });

    }

    console.log(
      "🔥 Cancelling Shipment AWB:",
      latestOrder.awb
    );

    // ======================================
    // NIMBUS CANCEL
    // ======================================

    const form =
      new FormData();

    form.append(
      "awb",
      String(latestOrder.awb)
    );

    const response =
      await fetch(

        "https://ship.nimbuspost.com/api/shipment/cancel",

        {

          method: "POST",

          headers: {

            "NP-API-KEY":

              process.env
                .NIMBUS_API_KEY,

            ...form.getHeaders()

          },

          body: form

        }

      );

    const data =
      await response.json();

    console.log(
      "🔥 Nimbus Cancel Response:",
      data
    );

    return res.json({

      success:
        data.status === true,

      message:

        data.message ||

        "Order cancelled successfully",

      data

    });

  } catch (err) {

    console.error(
      "❌ Cancel Error:",
      err
    );

    return res.status(500).json({

      success: false,

      message:
        err.message

    });

  }

});

// ======================================
// GET ALL ORDERS
// ======================================

app.get("/orders", (req, res) => {

  res.json(orders);

});

// ======================================
// GET SINGLE ORDER
// ======================================

app.get("/get-order/:id", (req, res) => {

  const order =
    orders.find(

      o =>

        String(o.orderId || "") ===

        String(req.params.id)

        ||

        String(
          o.nimbusOrderId || ""
        ) ===

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

// ======================================
// TEST
// ======================================

app.get("/test", (req, res) => {

  res.json({

    success: true,

    message:
      "Server working"

  });

});

// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {

  console.log(
    "🚀 Server running on port " +
    PORT
  );

});
