import axios from "axios";
import { loggingSystem } from "../helpers/loggingSystem.js";

const { NOTION_TOKEN } = process.env;
const NOTION_DATABASE_ID = "13bec93bba6f80a0a61eea6ac79e72fb";

// Вспомогательная функция для извлечения текста из массива заголовков Notion
const getPlainTextFromTitle = (title = []) =>
  title
    .map((item) => item?.plain_text ?? "")
    .join("")
    .trim();

// Вспомогательная функция для извлечения текста из массива rich_text Notion
const getPlainTextFromRichText = (richText = []) =>
  richText
    .map((item) => item?.plain_text ?? "")
    .join("")
    .trim();

export const getOnuSerialsFromNotion = async () => {
  const url = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

  try {
    const response = await axios.post(
      url,
      {},
      {
        timeout: 30000,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
      },
    );

    const results = Array.isArray(response.data?.results) ? response.data.results : [];

    return results
      .map((page) => {
        const properties = page?.properties ?? {};
        const serial = getPlainTextFromTitle(properties?.Name?.title);
        const address = getPlainTextFromRichText(properties?.["Адреса"]?.rich_text);

        if (!serial) {
          return null;
        }

        return {
          hexSerial: serial,
          address: address || null,
        };
      })
      .filter(Boolean);
  } catch (error) {
    let msg = "Unknown error";

    if (error.code === "ECONNABORTED") msg = "Request timeout";
    else if (error.response) msg = `${error.response.status} ${error.response.statusText}`;
    else msg = error.message;

    await loggingSystem("log/error.log", `Notion API error: ${msg}`);
    throw error;
  }
};
