import axios from "axios";
import { loggingSystem } from "../helpers/loggingSystem.js";

const { GRUSHER_IP } = process.env;
const MAC_ADDRESS_REGEX = /\b[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}\b/g;

export const getOnuCliMacCount = async (onuPath) => {
  const URL = `http://${GRUSHER_IP}/api?cat=device&action=custom_cli&device_id=1&command_id=2&variables[%EMPTY%]=${encodeURIComponent(
    onuPath,
  )}`;

  try {
    const response = await axios.get(URL, {
      timeout: 30000,
      headers: { Accept: "application/json" },
    });

    const data = response.data;

    if (!data || typeof data.result !== "string") {
      await loggingSystem(
        "log/error.log",
        `Invalid Grusher custom CLI response for ONU ${onuPath}: ${JSON.stringify(data)}`,
      );
      return null;
    }

    const macMatches = data.result.match(MAC_ADDRESS_REGEX) ?? [];

    return macMatches.length;
  } catch (error) {
    let msg = "Unknown error";

    if (error.code === "ECONNABORTED") msg = "Request timeout";
    else if (error.response) msg = `${error.response.status} ${error.response.statusText}`;
    else msg = error.message;

    await loggingSystem("log/error.log", `Grusher custom CLI API error (${onuPath}): ${msg}`);
    throw error;
  }
};
