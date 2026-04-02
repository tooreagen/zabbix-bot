import "dotenv/config";
import cron from "node-cron";
import { sendWeeklyMacReport } from "./utils/onuMacCountReport.js";
import { bot } from "./bot.js";

cron.schedule("15 12 * * 4", async () => {
  await sendWeeklyMacReport();
});

bot.start();

console.log("Bot started");
