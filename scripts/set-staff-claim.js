const admin = require('firebase-admin');
// Usage: FIREBASE_SERVICE_ACCOUNT='{"type":...}' node scripts/set-staff-claim.js staff@example.com
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
const email = process.argv[2];
if (!raw || !email) throw new Error('Set FIREBASE_SERVICE_ACCOUNT and provide a staff email.');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
(async () => { const user = await admin.auth().getUserByEmail(email); await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), staff: true }); console.log('Staff claim set for', email); })().catch(e => { console.error(e); process.exit(1); });
