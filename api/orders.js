const admin = require("firebase-admin");
const catalog = require("../lib/catalog");
function db() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin.firestore();
}
function json(res,status,body){res.status(status).setHeader("Content-Type","application/json");res.end(JSON.stringify(body));}
function safeId(v){return typeof v==="string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);}
module.exports=async(req,res)=>{
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  try{
    const {restaurantId:requestedRestaurantId,tableId,items,paymentMethod}=req.body||{};
    const restaurantId=requestedRestaurantId||"aurum-demo";
    if(!safeId(restaurantId)||!safeId(tableId))return json(res,400,{error:"A valid restaurant and table QR are required."});
    if(!["counter","online"].includes(paymentMethod))return json(res,400,{error:"Choose counter or online payment."});
    if(!Array.isArray(items)||!items.length||items.length>30)return json(res,400,{error:"Your cart is empty or too large."});
    const store=db();let restaurantName="AURUM",normalized=[];
    if(restaurantId==="aurum-demo"&&!requestedRestaurantId){
      for(const item of items){const product=catalog[item.id],quantity=Number(item.quantity);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>20)return json(res,400,{error:"Invalid cart item."});normalized.push({id:item.id,name:product.name,unitPrice:product.price,quantity,lineTotal:product.price*quantity});}
    } else {
      const restaurantSnap=await store.collection("restaurants").doc(restaurantId).get();
      if(!restaurantSnap.exists||restaurantSnap.data().status!=="active")return json(res,404,{error:"This restaurant menu is unavailable."});
      restaurantName=restaurantSnap.data().name||"Restaurant";
      for(const item of items){
        if(!safeId(item.id))return json(res,400,{error:"Invalid menu item."});
        const quantity=Number(item.quantity),snap=await store.collection("restaurants").doc(restaurantId).collection("menuItems").doc(item.id).get();
        if(!snap.exists||snap.data().available===false)return json(res,409,{error:"An item in your cart is no longer available. Refresh the menu and try again."});
        const product=snap.data();if(!Number.isInteger(quantity)||quantity<1||quantity>20||!Number.isInteger(product.price)||product.price<1)return json(res,400,{error:"Invalid item quantity or price."});
        normalized.push({id:item.id,name:product.name,unitPrice:product.price,quantity,lineTotal:product.price*quantity});
      }
    }
    const total=normalized.reduce((sum,item)=>sum+item.lineTotal,0);
    if(total<1||total>200000)return json(res,400,{error:"Order total is outside the permitted range."});
    const orderRef=store.collection("orders").doc(),now=admin.firestore.FieldValue.serverTimestamp();
    const base={restaurantId,restaurantName,tableId,items:normalized,subtotal:total,total,currency:"INR",paymentMethod,paymentStatus:paymentMethod==="counter"?"unpaid":"pending",status:paymentMethod==="counter"?"new":"awaiting_payment",createdAt:now,updatedAt:now};
    if(paymentMethod==="counter"){await orderRef.set(base);return json(res,201,{orderId:orderRef.id,status:"new",paymentStatus:"unpaid"});}
    if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return json(res,503,{error:"Online payments are not configured yet. Please choose pay at counter."});
    const auth=Buffer.from(process.env.RAZORPAY_KEY_ID+":"+process.env.RAZORPAY_KEY_SECRET).toString("base64");
    const response=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/json"},body:JSON.stringify({amount:total*100,currency:"INR",receipt:orderRef.id,notes:{restaurantId,tableId}})});
    const paymentOrder=await response.json();if(!response.ok)throw new Error(paymentOrder.error?.description||"Payment provider could not create an order");
    await orderRef.set({...base,status:"awaiting_payment",razorpayOrderId:paymentOrder.id});
    return json(res,201,{orderId:orderRef.id,razorpayOrderId:paymentOrder.id,amount:paymentOrder.amount,currency:paymentOrder.currency,keyId:process.env.RAZORPAY_KEY_ID,restaurantName});
  }catch(error){console.error("order_create_failed",error);return json(res,500,{error:"We could not place your order. Please try again or pay at the counter."});}
};