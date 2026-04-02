import { getOnuCliMacCount } from "../api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "../api/getOnuPathFromGrusher.js";
import { getOnuSerialsFromNotion } from "../api/getOnuSerialsFromNotion.js";
import { loggingSystem } from "../helpers/loggingSystem.js";
import { bot } from "../bot.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const onuMacCountReport = async () => {
  const startedAt = Date.now();
  const onuList = await getOnuSerialsFromNotion();
  const reportLines = [];
  let totalMacCount = 0;
  let processedCount = 0;

  // Функція для логування залишкового часу виконання
  const logRemainingTime = () => {
    processedCount += 1;

    const elapsedMs = Date.now() - startedAt;
    const averageIterationMs = elapsedMs / processedCount;
    const remainingIterations = onuList.length - processedCount;
    const estimatedRemainingMs = averageIterationMs * remainingIterations;
    const estimatedRemainingSeconds = (estimatedRemainingMs / 1000).toFixed(2);

    console.log(
      `Processed ${processedCount}/${onuList.length}. Estimated time remaining: ${estimatedRemainingSeconds}s`,
    );
  };

  for (const { serial, address } of onuList) {
    try {
      await loggingSystem("log/grusher-report.log", `Start processing serial ${serial}`);

      const onuPath = await getOnuPathFromGrusher(serial);

      if (!onuPath) {
        await loggingSystem("log/grusher-report.log", `Path not found for serial ${serial}`);
        reportLines.push(`${serial} [${address ?? "Без адреси"}] [path not found]`);
        logRemainingTime();
        continue;
      }

      const macCount = await getOnuCliMacCount(onuPath);
      if (typeof macCount === "number") {
        totalMacCount += macCount;
      }

      reportLines.push(`${serial} [${address ?? "Без адреси"}] [${macCount ?? "unknown"}]`);
      logRemainingTime();
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${serial}: ${error.message}`,
      );
      reportLines.push(`${serial} [${address ?? "Без адреси"}] [error]`);
      logRemainingTime();
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

export const sendWeeklyMacReport = async () => {
  const message = await onuMacCountReport();

  if (!TELEGRAM_REPORT_CHAT_ID) {
    await loggingSystem(
      "log/error.log",
      "TELEGRAM_REPORT_CHAT_ID is not set. Telegram report was not sent.",
    );
    return;
  }

  try {
    // await bot.api.sendMessage(TELEGRAM_REPORT_CHAT_ID, message);
    console.log("Telegram report:\n" + message);
  } catch (error) {
    await loggingSystem("log/error.log", `Failed to send Telegram report: ${error.message}`);
  }
};
