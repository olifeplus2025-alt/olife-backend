// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// const PORT = process.env.PORT || 5000;
// let orders = [];

// function getAwb(data) {
//   return data?.awb_number || data?.awb || data?.data?.awb_number || data?.data?.awb || data?.data?.shipment?.awb_number || "";
// }
// function getNimbusOrderId(data) {
//   return (
//     data?.data?.order_id ||
//     data?.order_id ||
//     data?.data?.shipment_id ||
//     data?.shipment_id ||
//     ""
//   );
// }
// // CREATE SHIPMENT / ORDER IN NIMBUSPOST
// app.post("/create-shipment", async (req, res) => {
//   try {
//     const order = req.body || {};
//     const items = Array.isArray(order.items) ? order.items : [];

//     const payload = {
//       consignee: {
//         name: order.name || order.customerName || "Customer",
//         address: order.address || "",
//         address_2: order.address_2 || "",
//         city: order.city || "",
//         state: order.state || "",
//         pincode: String(order.pincode || ""),
//         phone: String(order.phone || order.phoneNumber || "")
//       },
//       order: {
//         order_number: order.orderId || "ORD" + Date.now(),
//         shipping_charges: Number(order.shipping || 0),
//         discount: Number(order.discount || 0),
//         cod_charges: Number(order.codCharge || 0),
//         payment_type: (order.paymentMethod || order.paymentType) === "COD" ? "cod" : "prepaid",
//         total: Number(order.total || 0),
//         package_weight: Number(order.package_weight || 300),
//         package_length: Number(order.package_length || 10),
//         package_height: Number(order.package_height || 10),
//         package_breadth: Number(order.package_breadth || 10)
//       },
//       order_items: items.map((item, index) => ({
//         name: item.name || "Product",
//         qty: String(item.quantity || item.qty || 1),
//         price: String(item.price || 0),
//         sku: item.id || item.sku || "SKU" + (index + 1)
//       })),
//       pickup_warehouse_id: process.env.PICKUP_WAREHOUSE_ID,
//       rto_warehouse_id: process.env.RTO_WAREHOUSE_ID || process.env.PICKUP_WAREHOUSE_ID
//     };

//     console.log("📦 Create Payload:", JSON.stringify(payload, null, 2));
//     console.log("API KEY FOUND:", process.env.NIMBUS_API_KEY ? "YES" : "NO");

//     const response = await fetch("https://ship.nimbuspost.com/api/shipments/create", {
//       method: "POST",
//       headers: {
//         "NP-API-KEY": process.env.NIMBUS_API_KEY,
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify(payload)
//     });

//     const data = await response.json();
//     console.log("🚚 Nimbus Response:", data);

//     const awb = getAwb(data);
//     const nimbusOrderId = getNimbusOrderId(data); // 🔥 NEW
//     console.log("🔥 Nimbus Order ID:", nimbusOrderId);
//     const savedOrder = {
//       ...order,
//       awb,
//       nimbusOrderId, // 🔥 MOST IMPORTANT
//       nimbusResponse: data,
//       status: data.status ? "Order Placed" : (order.status || "Order Placed"),
//       shipmentStatus: data.status ? "Created" : "Failed",
//       createdAt: new Date().toISOString()
//     };
//     orders = orders.filter(o => String(o.orderId || "") !== String(savedOrder.orderId || ""));
//     orders.unshift(savedOrder);

//     res.status(response.status).json({
//       success: data.status === true,
//       message: data.message || "Nimbus response received",
//       awb,
//       nimbus: data,
//       order: savedOrder
//     });
//   } catch (err) {
//     console.error("❌ Create Error:", err.message);
//     res.status(500).json({ success: false, message: "Shipment create failed", error: err.message });
//   }
// });

// // CANCEL ORDER IN NIMBUSPOST
// app.post("/cancel-order", async (req, res) => {
//   try {
//     const { nimbusOrderId } = req.body;

//     if (!nimbusOrderId) {
//       return res.json({
//         success: false,
//         message: "Nimbus order id missing"
//       });
//     }

//     const response = await fetch("https://ship.nimbuspost.com/api/shipments/cancel", {
//       method: "POST",
//       headers: {
//         "NP-API-KEY": process.env.NIMBUS_API_KEY,
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({
//         order_id: nimbusOrderId
//       })
//     });

//     const data = await response.json();
//     console.log("Cancel Response:", data);

//     res.json({
//       success: data.status === true,
//       message: data.message || "Cancel response",
//       data
//     });

//   } catch (err) {
//     console.error("Cancel Error:", err.message);
//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// });
//   const data = await response.json();
//   res.json(data);
// });
// app.get("/orders", (req, res) => res.json(orders));
// app.get("/get-order/:id", (req, res) => {
//   const order = orders.find(o => String(o.orderId || "") === String(req.params.id) || String(o.awb || "") === String(req.params.id));
//   if (!order) return res.json({ success: false, message: "Order not found" });
//   res.json({ success: true, order });
// });
// app.get("/test", (req, res) => res.json({ success: true, message: "Server working" }));

// app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

let orders = [];

// GET AWB
// function getAwb(data) {
//   return (
//     data?.awb_number ||
//     data?.awb ||
//     data?.data?.awb_number ||
//     data?.data?.awb ||
//     // data?.data?.shipment?.awb_number ||
//     ""
//   );
// }

// GET NIMBUS ORDER ID
function getNimbusOrderId(data) {
  return (
    data?.data?.order_id ||
    data?.order_id ||
    data?.data?.shipment_id ||
    data?.shipment_id ||
    ""
  );
}

// =============================
// CREATE SHIPMENT / ORDER
// =============================
app.post("/create-shipment", async (req, res) => {
  try {
    const order = req.body || {};
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

        payment_type:
          (order.paymentMethod || order.paymentType) === "COD"
            ? "cod"
            : "prepaid",

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

      rto_warehouse_id:
        process.env.RTO_WAREHOUSE_ID ||
        process.env.PICKUP_WAREHOUSE_ID
    };

    console.log(
      "📦 Create Payload:",
      JSON.stringify(payload, null, 2)
    );

    console.log(
      "API KEY FOUND:",
      process.env.NIMBUS_API_KEY ? "YES" : "NO"
    );

    const form = new FormData();

    form.append(
      "data",
      JSON.stringify(payload)
    );

    const response = await fetch(
      "https://ship.nimbuspost.com/api/orders/create",
      {
        method: "POST",

        headers: {
          "NP-API-KEY":
            process.env.NIMBUS_API_KEY,

          ...form.getHeaders()
        },

        body: form
      }
    );

    const data = await response.json();

    console.log("🚚 Nimbus Response:", data);

    const nimbusOrderId = getNimbusOrderId(data);

    console.log("🔥 Nimbus Order ID:", nimbusOrderId);

    const savedOrder = {
      ...order,

      nimbusOrderId,

      nimbusResponse: data,

      status: data.status
        ? "Order Placed"
        : order.status || "Order Placed",

      shipmentStatus: data.status
        ? "Created"
        : "Failed",

      createdAt: new Date().toISOString()
    };

    // remove duplicate order
    orders = orders.filter(
      o =>
        String(o.orderId || "") !==
        String(savedOrder.orderId || "")
    );

    // add latest order
    orders.unshift(savedOrder);

    res.status(response.status).json({
      success: data.status === true,

      message:
        data.message || "Nimbus response received",



      nimbus: data,

      order: savedOrder
    });

  } catch (err) {

    console.error("❌ Create Error:", err.message);

    res.status(500).json({
      success: false,
      message: "Shipment create failed",
      error: err.message
    });
  }
});


// CANCEL ORDER
// =============================
app.post("/cancel-order", async (req, res) => {

  try {

    const { nimbusOrderId } = req.body;

    if (!nimbusOrderId) {

      return res.json({
        success: false,
        message: "Nimbus Order ID missing"
      });

    }

    console.log(
      "🔥 FINAL CANCEL ID:",
      nimbusOrderId
    );

    const form = new FormData();

    form.append(
      "id",
      String(nimbusOrderId)
    );

    const response = await fetch(
      "https://ship.nimbuspost.com/api/orders/cancel",
      {
        method: "POST",

        headers: {
          "NP-API-KEY":
            process.env.NIMBUS_API_KEY,

          ...form.getHeaders()
        },

        body: form
      }
    );

    const data = await response.json();

    console.log(
      "🔥 FINAL NIMBUS RESPONSE:",
      JSON.stringify(data, null, 2)
    );

    // UPDATE LOCAL ORDER
    orders = orders.map(order => {

      if (

        String(order.nimbusOrderId) ===
        String(nimbusOrderId)

      ) {

        return {

          ...order,

          status: "Cancelled",

          shipmentStatus: "Cancelled",

          cancelledAt:
            new Date().toISOString()

        };

      }

      return order;

    });

    return res.json({

      success:
        data.status === true,

      message:
        data.message ||
        "Order cancelled",

      data

    });

  } catch (err) {

    console.error(
      "❌ FINAL ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message: err.message

    });

  }

});


// =============================
// GET ALL ORDERS
// =============================
app.get("/orders", (req, res) => {
  res.json(orders);
});

// =============================
// GET SINGLE ORDER
// =============================
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
      message: "Order not found"
    });
  }

  res.json({
    success: true,
    order
  });
});

// =============================
// TEST ROUTE
// =============================
app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Server working"
  });
});

// =============================
// START SERVER
// =============================
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
