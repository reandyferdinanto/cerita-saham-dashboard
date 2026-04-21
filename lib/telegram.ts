export async function sendTelegramMessage(chatId: string | number, text: string, token: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram Error:", data);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram Fetch Error:", error);
    return false;
  }
}

export function escapeMarkdown(text: string) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
