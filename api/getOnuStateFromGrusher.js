import axios from "axios";
import { loggingSystem } from "../helpers/loggingSystem.js";

const { GRUSHER_IP } = process.env;

export const getOnuStateFromGrusher = async (serial) => {
  const URL = `http://${GRUSHER_IP}/api?cat=device&action=get_onu_info&param=${encodeURIComponent(
    serial,
  )}`;

  try {
    const response = await axios.get(URL, {
      timeout: 5000,
      headers: { Accept: "application/json" },
    });

    const data = response.data;

    if (!data || typeof data.result !== "object") {
      await loggingSystem(
        "log/error.log",
        `Invalid Grusher response for serial ${serial}: ${JSON.stringify(data)}`,
      );
      return null;
    }

    return data;
  } catch (error) {
    let msg = "Unknown error";

    if (error.code === "ECONNABORTED") msg = "Request timeout";
    else if (error.response) msg = `${error.response.status} ${error.response.statusText}`;
    else msg = error.message;

    await loggingSystem("log/error.log", `Grusher API error (${serial}): ${msg}`);
    throw error;
  }
};
