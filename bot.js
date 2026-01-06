import { Bot } from "grammy";
import { loggingSystem } from "./helpers/loggingSystem.js";
import { getOnuStateFromGrusher } from "./api/getOnuStateFromGrusher.js";

export const bot = new Bot(process.env.BOT_TOKEN);

bot.catch(async (error) => {
  await loggingSystem("log/error.log", `Global bot error: ${error.message}`);
});

bot.callbackQuery(/^grusher:(.+)/, async (ctx) => {
  const serial = ctx.match[1];

  let data;
  try {
    data = await getOnuStateFromGrusher(serial);
  } catch {
    await ctx.answerCallbackQuery({
      text: "❌ Помилка запиту до Grusher",
      show_alert: true,
    });
    return;
  }

  const result = data?.result;

  if (!result || Object.keys(result).length === 0) {
    await ctx.answerCallbackQuery({
      text: "❌ ONU не знайдено",
      show_alert: true,
    });
    return;
  }

  const onuKey = Object.keys(result)[0];
  const onu = result[onuKey];

  const state = onu?.onu_deregister_cause ?? "UNKNOWN";

  const originalText = ctx.callbackQuery.message.text;

  if (originalText.includes("📡 Статус ONU:")) {
    await ctx.answerCallbackQuery({
      text: "ℹ️ Статус вже додано",
    });
    return;
  }

  try {
    await ctx.api.editMessageText(
      ctx.chat.id,
      ctx.callbackQuery.message.message_id,
      `${originalText}\n\n📡 Статус ONU: ${state}`
    );
  } catch (error) {
    await loggingSystem("log/error.log", `Edit message error: ${error.message}`);
  }

  await ctx.answerCallbackQuery();
});
