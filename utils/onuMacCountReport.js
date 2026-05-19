import { getOnuActiveMacCount } from "../api/getOnuActiveMacCount.js";
import { loggingSystem } from "../helpers/loggingSystem.js";
import { bot } from "../bot.js";
import { convertOnuHexSNToReadable } from "../helpers/convertOnuHexSNToReadable.js";
import { getOnuSerialsFromNotion } from "../api/getOnuSerialsFromNotion.js";

const { TELEGRAM_REPORT_CHAT_ID } = process.env;

const TELEGRAM_MAX_MESSAGE_LENGTH = 4000;
const ITERATION_DELAY_MS = 500;
const REPORT_LOG_FILE = "log/grusher-report.log";

// Вспомогательная функция для создания задержки между итерациями цикла
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Функция для разбивки длинного сообщения на части, не превышающие лимит Telegram
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

// Функция для отправки сообщения в Telegram с автоматической разбивкой на части
const sendChunkedTelegramMessage = async (chatId, message) => {
  const chunks = splitMessageIntoChunks(message);

  for (const chunk of chunks) {
    await bot.api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
  }
};

// Вспомогательная функция для генерации отчета по количеству MAC на ОНУ и выявления ONT с 0 MAC подряд
const onuMacCountReport = async () => {
  const onuList = await getOnuSerialsFromNotion();
  const reportLines = []; //Общий отчет по количеству MAC на ОНУ
  const alertLines = []; //Предупреждения по ONT с 0 MAC
  const potentialAlerts = []; //ONT с 1 MAC, которые потенциально можно переключить
  let totalMacCount = 0;

  // Основной цикл по каждому ONT для получения количества MAC
  for (const [index, { hexSerial, address }] of onuList.entries()) {
    const safeAddress = address ?? "Без адреси";

    try {
      // преобразуем серийник вида hexSN, в читаемый серийник
      const serial = convertOnuHexSNToReadable(hexSerial);
      const macCount = await getOnuActiveMacCount(serial);

      if (typeof macCount === "number") {
        totalMacCount += macCount;
      }

      reportLines.push(`🆔${hexSerial} 📍[${safeAddress}] MAC=${macCount ?? "unknown"}`);

      // Если MAC=0, добавляем в предупреждения
      if (macCount === 0) {
        alertLines.push(`🆔${hexSerial} 📍[${safeAddress}] - 0 MAC за місяць`);
      }

      //Если macCount неизвестно, добавляем в предупреждения
      if (!macCount) {
        alertLines.push(`🆔${hexSerial} 📍[${safeAddress}] - Загальна помилка`);
      }

      // Если MAC=1, добавляем в потенциальные предупреждения
      if (macCount === 1) {
        potentialAlerts.push(`🆔${hexSerial} 📍[${safeAddress}] - 1 MAC за місяць`);
      }

      // Добавляем задержку между запросами, чтобы не перегружать API
      if (index < onuList.length - 1) {
        await delay(ITERATION_DELAY_MS);
      }
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to build MAC report for ${hexSerial}: ${error.message}`,
      );
      reportLines.push(`🆔${hexSerial} 📍[${safeAddress}] [error]`);
    }
  }

  return {
    alertMessage:
      alertLines.length > 0 ? ["🔴0 MAC за місяць / помилка", ...alertLines].join("\n") : null,
    reportMessage: [
      "Кількість MAC на будинкових ONU:",
      ...reportLines,
      "",
      `Всього MAC: ${totalMacCount}`,
    ].join("\n"),
    potentialAlertMessage:
      potentialAlerts.length > 0
        ? ["<b>🚐 Можна переключати</b>\n", ...potentialAlerts].join("\n")
        : null,
  };
};

// Главная функция для отправки еженедельного отчета по количеству MAC на ОНУ
export const sendWeeklyMacReport = async () => {
  // Получаем отчет и предупреждения по ONT с 0 MAC подряд
  const { reportMessage, alertMessage, potentialAlertMessage } = await onuMacCountReport();

  if (!TELEGRAM_REPORT_CHAT_ID) {
    await loggingSystem(
      "log/error.log",
      "TELEGRAM_REPORT_CHAT_ID is not set. Telegram report was not sent.",
    );
    await loggingSystem(
      REPORT_LOG_FILE,
      "TELEGRAM_REPORT_CHAT_ID is not set. Messages were printed to console.",
    );
    return;
  }

  try {
    // Первая часть отчета - общий отчет по количеству MAC на ОНУ
    await sendChunkedTelegramMessage(TELEGRAM_REPORT_CHAT_ID, reportMessage);
    await loggingSystem(REPORT_LOG_FILE, "Telegram report message sent.");

    // Вторая часть отчета - предупреждения по ONT с 0 MAC подряд
    if (alertMessage) {
      await sendChunkedTelegramMessage(TELEGRAM_REPORT_CHAT_ID, alertMessage);
      await loggingSystem(REPORT_LOG_FILE, "Telegram alert message sent.");
    }

    // Третья часть отчета - потенциальные предупреждения по ONT с 1 MAC
    if (potentialAlertMessage) {
      await sendChunkedTelegramMessage(TELEGRAM_REPORT_CHAT_ID, potentialAlertMessage);
      await loggingSystem(REPORT_LOG_FILE, "Telegram potential alert message sent.");
    }
  } catch (error) {
    await loggingSystem("log/error.log", `Failed to send Telegram report: ${error.message}`);
    await loggingSystem(REPORT_LOG_FILE, `Telegram send error: ${error.message}`);
  }
};
