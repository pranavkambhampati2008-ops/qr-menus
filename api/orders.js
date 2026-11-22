const crypto = require("node:crypto");
const admin = require("firebase-admin");
const catalog = require("../lib/catalog");

function db() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.firestore();
}
function json(res, status, body) { res.status(status).setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); }
function safeTable(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(value); }
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { tableId, items, paymentMethod } = req.body || {};
    if (!safeTable(tableId)) return json(res, 400, { error: "A valid table QR is required. Scan the QR attached to your table." });
    if (!["counter", "online"].includes(paymentMethod)) return json(res, 400, { error: "Choose counter or online payment." });
    if (!Array.isArray(items) || !items.length || items.length > 30) return json(res, 400, { error: "Your cart is empty or too large." });
    const normalized = [];
    for (const item of items) {
      const product = catalog[item.id];
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return json(res, 400, { error: "Invalid cart item." });
      normalized.push({ id: item.id, name: product.name, unitPrice: product.price, quantity, lineTotal: product.price * quantity });
    }
    const total = normalized.reduce((sum, item) => sum + item.lineTotal, 0);
    if (total < 1 || total > 200000) return json(res, 400, { error: "Order total is outside the permitted range." });
    const store = db();
    const orderRef = store.collection("orders").doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const base = { restaurantId: "aurum-demo", tableId, items: normalized, subtotal: total, total, currency: "INR", paymentMethod, paymentStatus: paymentMethod === "counter" ? "unpaid" : "pending", status: paymentMethod === "counter" ? "new" : "awaiting_payment", createdAt: now, updatedAt: now };
    if (paymentMethod === "counter") {
      await orderRef.set(base);
      return json(res, 201, { orderId: orderRef.id, status: "new", paymentStatus: "unpaid" });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return json(res, 503, { error: "Online payments are not configured yet. Please choose pay at counter." });
    const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" }, body: JSON.stringify({ amount: total * 100, currency: "INR", receipt: orderRef.id, notes: { restaurantId: "aurum-demo", tableId } }) });
    const paymentOrder = await response.json();
    if (!response.ok) throw new Error(paymentOrder.error?.description || "Payment provider could not create an order");
    await orderRef.set({ ...base, status: "awaiting_payment", razorpayOrderId: paymentOrder.id });
    return json(res, 201, { orderId: orderRef.id, razorpayOrderId: paymentOrder.id, amount: paymentOrder.amount, currency: paymentOrder.currency, keyId: process.env.RAZORPAY_KEY_ID, restaurantName: "AURUM" });
  } catch (error) {
    console.error("order_create_failed", error);
    return json(res, 500, { error: "We could not place your order. Please try again or pay at the counter." });
  }
};
