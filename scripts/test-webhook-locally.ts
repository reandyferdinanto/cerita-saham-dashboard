import { POST } from "../app/api/telegram/webhook/route";
import { NextRequest } from "next/server";

async function testWebhook(text: string) {
  const payload = {
    update_id: 12345,
    message: {
      message_id: 1,
      from: { id: 123, first_name: "Test" },
      chat: { id: 123, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: text,
    },
  };

  const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  console.log(`Testing command: ${text}`);
  const res = await POST(req);
  const data = await res.json();
  console.log("Response:", data);
}

// We can't easily run this because of NextRequest and NextResponse being from next/server
// which might not work well in pure node environment without some setup.
// But we can try npx tsx.
testWebhook(process.argv[2] || "/help");
