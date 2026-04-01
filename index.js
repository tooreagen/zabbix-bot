import "dotenv/config";
import cron from "node-cron";
import { bot } from "./bot.js";
import { getOnuCliMacCount } from "./api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "./api/getOnuPathFromGrusher.js";
import { onuSerials } from "./data/onuSerials.js";
import { loggingSystem } from "./helpers/loggingSystem.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const buildMacReport = async () => {
  const startedAt = Date.now();
  const reportLines = [];
  let totalMacCount = 0;

  for (const serial of onuSerials) {
    try {
      await loggingSystem("log/grusher-report.log", `Start processing serial ${serial}`);

      const onuPath = await getOnuPathFromGrusher(serial);

      if (!onuPath) {
        await loggingSystem("log/grusher-report.log", `Path not found for serial ${serial}`);
        reportLines.push(`${serial}: path not found`);
        continue;
      }

      const macCount = await getOnuCliMacCount(onuPath);
      if (typeof macCount === "number") {
        totalMacCount += macCount;
      }

      reportLines.push(`${serial}: ${macCount ?? "unknown"} MAC`);
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${serial}: ${error.message}`,
      );
      reportLines.push(`${serial}: error`);
    }
  }

  const durationMs = Date.now() - startedAt;
  const durationSeconds = (durationMs / 1000).toFixed(2);

  return [
    "Кількість MAC на будинкових ONU:",
    ...reportLines,
    "",
    `Всього MAC: ${totalMacCount}`,
    `Час виконання: ${durationSeconds}s`,
  ].join("\n");
};

const sendWeeklyMacReport = async () => {
  const message = await buildMacReport();

  if (!TELEGRAM_REPORT_CHAT_ID) {
    await loggingSystem(
      "log/error.log",
      "TELEGRAM_REPORT_CHAT_ID is not set. Telegram report was not sent.",
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
