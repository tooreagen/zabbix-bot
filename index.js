import "dotenv/config";
import cron from "node-cron";
import { sendWeeklyMacReport } from "./utils/onuMacCountReport.js";
import { bot } from "./bot.js";

// Отправка отчета по количеству МАС на ОНУ, каждую неделю во вторник в 14:00
cron.schedule("0 14 * * 2", async () => {
  await sendWeeklyMacReport();
});

bot.start();

console.log("Bot started");
