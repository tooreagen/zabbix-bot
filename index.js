import "dotenv/config";
import cron from "node-cron";
import { sendWeeklyMacReport } from "./utils/onuMacCountReport.js";

// cron.schedule("0 6 * * 1", async () => {
//   await sendWeeklyMacReport();
// });

cron.schedule("*/5 * * * *", async () => {
  await sendWeeklyMacReport();
});

// bot.start();

console.log("Bot started");
