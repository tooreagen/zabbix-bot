import "dotenv/config";
import cron from "node-cron";
import { sendWeeklyMacReport } from "./utils/onuMacCountReport.js";
import { getOnuSerialsFromNotion } from "./api/getOnuSerialsFromNotion.js";

// cron.schedule("0 6 * * 1", async () => {
//   await sendWeeklyMacReport();
// });

// cron.schedule("*/5 * * * *", async () => {
//   await sendWeeklyMacReport();
// });

cron.schedule("* * * * *", async () => {
  try {
    const data = await getOnuSerialsFromNotion();
    console.log("Notion ONU list:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to fetch Notion data:", error.message);
  }
});

// bot.start();

console.log("Bot started");
