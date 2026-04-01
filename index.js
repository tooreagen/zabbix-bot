import "dotenv/config";
import cron from "node-cron";
import { bot } from "./bot.js";
import { getOnuCliMacCount } from "./api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "./api/getOnuPathFromGrusher.js";
import { onuSerials } from "./data/onuSerials.js";
import { loggingSystem } from "./helpers/loggingSystem.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const buildMacReport = async () => {
  const reportLines = [];

  for (const serial of onuSerials) {
    try {
      const onuPath = await getOnuPathFromGrusher(serial);

      if (!onuPath) {
        reportLines.push(`${serial}: path not found`);
        continue;
      }

      const macCount = await getOnuCliMacCount(onuPath);
      reportLines.push(`${serial}: ${macCount ?? "unknown"} MAC`);
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${serial}: ${error.message}`,
      );
      reportLines.push(`${serial}: error`);
    }
  }

  return ["ONU MAC report:", ...reportLines].join("\n");
};

const sendWeeklyMacReport = async () => {
  const message = await buildMacReport();

  if (!TELEGRAM_REPORT_CHAT_ID) {
    await loggingSystem(
      "log/error.log",
      "TELEGRAM_REPORT_CHAT_ID is not set. Telegram report was not sent."
    );
    return;
  }

  try {
    await bot.api.sendMessage(TELEGRAM_REPORT_CHAT_ID, message);
  } catch (error) {
    await loggingSystem("log/error.log", `Failed to send Telegram report: ${error.message}`);
  }
};

// cron.schedule("0 6 * * 1", async () => {
//   await sendWeeklyMacReport();
// });

cron.schedule("*/5 * * * *", async () => {
  await sendWeeklyMacReport();
});


// bot.start();

console.log("Bot started");
