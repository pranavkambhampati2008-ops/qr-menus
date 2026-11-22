const crypto = require("node:crypto");
const admin = require("firebase-admin");
function db() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}
function json(res, status, body) { res.status(status).setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); }
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (![orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === "string" && v.length < 256)) return json(res, 400, { error: "Missing payment verification fields." });
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return json(res, 503, { error: "Payment verification is not configured." });
    const expected = crypto.createHmac("sha256", secret).update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    const a = Buffer.from(expected); const b = Buffer.from(razorpay_signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 400, { error: "Payment signature could not be verified." });
    const store = db(); const ref = store.collection("orders").doc(orderId); const snap = await ref.get();
    if (!snap.exists || snap.data().razorpayOrderId !== razorpay_order_id) return json(res, 404, { error: "Order not found for this payment." });
    if (snap.data().paymentStatus === "paid") return json(res, 200, { ok: true, orderId });
    await ref.update({ paymentStatus: "paid", status: "new", razorpayPaymentId: razorpay_payment_id, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return json(res, 200, { ok: true, orderId });
  } catch (error) {
    console.error("payment_verify_failed", error);
    return json(res, 500, { error: "Payment was received but could not be verified here. Please contact the restaurant with your payment reference." });
  }
};
