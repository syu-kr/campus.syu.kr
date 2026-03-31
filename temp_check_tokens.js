const serviceAccount = require('.env.local');
const admin = require("firebase-admin");

// Load Firebase credentials from .env.local
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.+?)(?:\n|$)/);

if (!match) {
  console.error("FIREBASE_SERVICE_ACCOUNT not found in .env.local");
  process.exit(1);
}

const serviceAccountJson = JSON.parse(match[1]);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountJson),
});

const db = admin.firestore();

(async () => {
  try {
    const snapshot = await db.collection("user_devices").get();
    
    console.log(`\n��� Firestore user_devices 컬렉션 검사`);
    console.log(`총 문서 수: ${snapshot.size}`);
    console.log(`\n문서 상세정보:`);
    
    let activeCount = 0;
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      if (data.active) activeCount++;
      console.log(`\n[${index + 1}] ID: ${doc.id}`);
      console.log(`    Token: ${data.fcm_token?.substring(0, 30)}...`);
      console.log(`    Active: ${data.active}`);
      console.log(`    Created: ${data.created_at?.toDate?.() || data.created_at}`);
      console.log(`    Updated: ${data.updated_at?.toDate?.() || data.updated_at}`);
    });
    
    console.log(`\n✅ 활성 토큰: ${activeCount}개`);
  } catch (error) {
    console.error("Error:", error);
  }
})();
