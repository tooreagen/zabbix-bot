import { getOnuCliMacCount } from "../api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "../api/getOnuPathFromGrusher.js";
import { getOnuSerialsFromNotion } from "../api/getOnuSerialsFromNotion.js";
import { loggingSystem } from "../helpers/loggingSystem.js";
import { bot } from "../bot.js";
import { loadOnuZeroState, saveOnuZeroState } from "./onuZeroState.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const ZERO_STREAK_ALERT_THRESHOLD = 4;

const onuMacCountReport = async () => {
  const startedAt = Date.now();
  const onuList = await getOnuSerialsFromNotion();
  const zeroState = await loadOnuZeroState();
  const reportLines = [];
  const alertLines = [];
  let totalMacCount = 0;
  let processedCount = 0;

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
    const safeAddress = address ?? "Без адреси";

    try {
      await loggingSystem("log/grusher-report.log", `Start processing serial ${serial}`);

      const onuPath = await getOnuPathFromGrusher(serial);

      if (!onuPath) {
        await loggingSystem("log/grusher-report.log", `Path not found for serial ${serial}`);
        reportLines.push(`${serial} [${safeAddress}] [path not found]`);
        logRemainingTime();
        continue;
      }

      const macCount = await getOnuCliMacCount(onuPath);

      if (typeof macCount === "number") {
        totalMacCount += macCount;
      }

      const previousState = zeroState[serial] ?? {};
      const nextZeroStreak = macCount === 0 ? (previousState.zeroStreak ?? 0) + 1 : 0;
      const nowIso = new Date().toISOString();

      zeroState[serial] = {
        address: safeAddress,
        lastCheckedAt: nowIso,
        lastMacCount: macCount,
        zeroStreak: nextZeroStreak,
      };

      if (nextZeroStreak >= ZERO_STREAK_ALERT_THRESHOLD) {
        alertLines.push(`${serial} [${safeAddress}] [0] [${nextZeroStreak} weeks]`);
      }

      reportLines.push(`${serial} [${safeAddress}] [${macCount ?? "unknown"}]`);
      logRemainingTime();
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${serial}: ${error.message}`,
      );
      reportLines.push(`${serial} [${safeAddress}] [error]`);
      logRemainingTime();
    }
  }

  await saveOnuZeroState(zeroState);

  const durationMs = Date.now() - startedAt;
  const durationSeconds = (durationMs / 1000).toFixed(2);

  return {
    alertMessage:
      alertLines.length > 0
        ? ["ПОПЕРЕДЖЕННЯ: ONT має 0 MAC за 4 або більше перевірок поспіль", ...alertLines].join("\n")
        : null,
    reportMessage: [
      "Кількість MAC на будинкових ONU:",
      ...reportLines,
      "",
      `Всього MAC: ${totalMacCount}`,
      `Час виконання: ${durationSeconds}s`,
    ].join("\n"),
  };
};

export const sendWeeklyMacReport = async () => {
  const { reportMessage, alertMessage } = await onuMacCountReport();

  if (!TELEGRAM_REPORT_CHAT_ID) {
    await loggingSystem(
      "log/error.log",
      "TELEGRAM_REPORT_CHAT_ID is not set. Telegram report was not sent.",
    );
    console.log("Telegram report:\n" + reportMessage);

    if (alertMessage) {
      console.log("Telegram alert:\n" + alertMessage);
    }

    return;
  }

  try {
    await bot.api.sendMessage(TELEGRAM_REPORT_CHAT_ID, reportMessage);

    if (alertMessage) {
      await bot.api.sendMessage(TELEGRAM_REPORT_CHAT_ID, alertMessage);
    }
  } catch (error) {
    await loggingSystem("log/error.log", `Failed to send Telegram report: ${error.message}`);
  }
};
