import { getOnuCliMacCount } from "../api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "../api/getOnuPathFromGrusher.js";
import { getOnuSerialsFromNotion } from "../api/getOnuSerialsFromNotion.js";
import { loggingSystem } from "../helpers/loggingSystem.js";
import { bot } from "../bot.js";
import { loadOnuZeroState, saveOnuZeroState } from "./onuZeroState.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const ZERO_STREAK_ALERT_THRESHOLD = 4;
const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;
const ITERATION_DELAY_MS = 500;
const REPORT_LOG_FILE = "log/grusher-report.log";
const PROGRESS_LOG_FILE = "log/progress.log";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const splitMessageIntoChunks = (message) => {
  if (message.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return [message];
  }

  const chunks = [];
  const lines = message.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    const candidate = currentChunk ? `${currentChunk}\n${line}` : line;

    if (candidate.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    if (line.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      currentChunk = line;
      continue;
    }

    let remainingLine = line;

    while (remainingLine.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
      chunks.push(remainingLine.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH));
      remainingLine = remainingLine.slice(TELEGRAM_MAX_MESSAGE_LENGTH);
    }

    currentChunk = remainingLine;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const sendChunkedTelegramMessage = async (chatId, message) => {
  const chunks = splitMessageIntoChunks(message);

  for (const chunk of chunks) {
    await bot.api.sendMessage(chatId, chunk);
  }
};

const onuMacCountReport = async () => {
  const startedAt = Date.now();
  const runStartedAtIso = new Date().toISOString();
  const onuList = await getOnuSerialsFromNotion();
  const zeroState = await loadOnuZeroState();
  const reportLines = [];
  const alertLines = [];
  let totalMacCount = 0;
  let processedCount = 0;

  await loggingSystem(
    REPORT_LOG_FILE,
    `Weekly MAC report started. ONT count: ${onuList.length}. Started at: ${runStartedAtIso}`,
  );

  const logRemainingTime = async () => {
    processedCount += 1;

    const elapsedMs = Date.now() - startedAt;
    const averageIterationMs = elapsedMs / processedCount;
    const remainingIterations = onuList.length - processedCount;
    const estimatedRemainingMs = averageIterationMs * remainingIterations;
    const estimatedRemainingMinutes = (estimatedRemainingMs / 60000).toFixed(2);
    const progressMessage = `Processed ${processedCount}/${onuList.length}. Estimated time remaining: ${estimatedRemainingMinutes} min`;

    await loggingSystem(PROGRESS_LOG_FILE, progressMessage);
    await loggingSystem(REPORT_LOG_FILE, progressMessage);
  };

  for (const [index, { serial, address }] of onuList.entries()) {
    const safeAddress = address ?? "Без адреси";

    try {
      await loggingSystem(REPORT_LOG_FILE, `Start processing serial ${serial} [${safeAddress}]`);

      const onuPath = await getOnuPathFromGrusher(serial);

      if (!onuPath) {
        await loggingSystem(REPORT_LOG_FILE, `Path not found for serial ${serial} [${safeAddress}]`);
        reportLines.push(`${serial} [${safeAddress}] [path not found]`);
        await logRemainingTime();
      } else {
        await loggingSystem(REPORT_LOG_FILE, `ONU path for ${serial}: ${onuPath}`);

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

        await loggingSystem(
          REPORT_LOG_FILE,
          `Result for ${serial}: address=[${safeAddress}], onuPath=[${onuPath}], macCount=[${macCount ?? "unknown"}], zeroStreak=[${nextZeroStreak}]`,
        );

        if (nextZeroStreak >= ZERO_STREAK_ALERT_THRESHOLD) {
          const alertLine = `${serial} [${safeAddress}] [0] [${nextZeroStreak} weeks]`;
          alertLines.push(alertLine);
          await loggingSystem(REPORT_LOG_FILE, `Alert triggered for ${alertLine}`);
        }

        reportLines.push(`${serial} [${safeAddress}] [${macCount ?? "unknown"}]`);
        await logRemainingTime();
      }
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${serial}: ${error.message}`,
      );
      await loggingSystem(REPORT_LOG_FILE, `Error for ${serial} [${safeAddress}]: ${error.message}`);
      reportLines.push(`${serial} [${safeAddress}] [error]`);
      await logRemainingTime();
    }

    if (index < onuList.length - 1) {
      await loggingSystem(REPORT_LOG_FILE, `Delay before next iteration: ${ITERATION_DELAY_MS} ms`);
      await delay(ITERATION_DELAY_MS);
    }
  }

  await saveOnuZeroState(zeroState);

  const durationMs = Date.now() - startedAt;
  const durationSeconds = (durationMs / 1000).toFixed(2);

  await loggingSystem(
    REPORT_LOG_FILE,
    `Weekly MAC report finished. Total MAC: ${totalMacCount}. Duration: ${durationSeconds}s. Alerts: ${alertLines.length}`,
  );

  return {
    alertMessage:
      alertLines.length > 0
        ? ["ПОПЕРЕДЖЕННЯ: ONT має 0 MAC за 4 або більше перевірок поспіль", ...alertLines].join(
            "\n",
          )
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
    await loggingSystem(REPORT_LOG_FILE, "TELEGRAM_REPORT_CHAT_ID is not set. Messages were printed to console.");
    return;
  }

  try {
    await sendChunkedTelegramMessage(TELEGRAM_REPORT_CHAT_ID, reportMessage);
    await loggingSystem(REPORT_LOG_FILE, "Telegram report message sent.");

    if (alertMessage) {
      await sendChunkedTelegramMessage(TELEGRAM_REPORT_CHAT_ID, alertMessage);
      await loggingSystem(REPORT_LOG_FILE, "Telegram alert message sent.");
    }
  } catch (error) {
    await loggingSystem("log/error.log", `Failed to send Telegram report: ${error.message}`);
    await loggingSystem(REPORT_LOG_FILE, `Telegram send error: ${error.message}`);
  }
};
