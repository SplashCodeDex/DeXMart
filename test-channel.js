const jwt = require("jsonwebtoken");

async function testChannelAPI() {
  const secret = "7f9d8a2b5c4e1f3a6d9b8c7e5a4d3f2b1a0c9e8d7f6a5b4c3d2e1f0a9b8c7e6d";
  const token = jwt.sign(
    { tenantId: "system_default", id: "admin_user", role: "system_admin" },
    secret,
    { expiresIn: "1h" },
  );

  // Firestore data already seeded from previous runs — skip to avoid duplicate Firebase Admin conflicts

  console.log("[1] Creating new WhatsApp channel via API...");
  const createRes = await fetch("http://localhost:3001/api/internal/channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: "API Test Channel",
      type: "whatsapp",
    }),
  });

  if (!createRes.ok) {
    throw new Error("Failed to create channel: " + (await createRes.text()));
  }

  const { data: channel } = await createRes.json();
  console.log(`[2] Channel created: ${channel.id}`);

  // Call connect route explicitly just in case auto-connect is async or slow
  console.log(`[3] Initiating connection for channel ${channel.id}...`);
  const connectRes = await fetch(
    `http://localhost:3001/api/internal/channels/${channel.id}/connect`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!connectRes.ok) throw new Error("Failed to connect channel: " + (await connectRes.text()));

  console.log("[4] Waiting 5 seconds for Baileys to generate QR code...");
  await new Promise((r) => setTimeout(r, 5000));

  console.log(`[5] Fetching QR code for channel ${channel.id}...`);
  const qrRes = await fetch(`http://localhost:3001/api/internal/channels/${channel.id}/qr`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const qrData = await qrRes.json();
  if (qrData.data && qrData.data.qrCode) {
    console.log("\n[SUCCESS] ✨ QR Code successfully generated via API!");
    console.log("QR Base64 Start: " + qrData.data.qrCode.substring(0, 50) + "...\n");
  } else {
    console.log(
      "\n[WARNING] QR Code not generated yet. Baileys might still be synchronizing or the session was reused.",
    );
    console.log(qrData);
  }
}

testChannelAPI().catch(console.error);
