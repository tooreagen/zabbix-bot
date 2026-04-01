import axios from "axios";
import { loggingSystem } from "../helpers/loggingSystem.js";

const { GRUSHER_IP } = process.env;
const IFACE_NAME_REGEX = /^GPON\s+(\d+\/\d+\/\d+):(\d+)$/i;

export const getOnuPathFromGrusher = async (serial) => {
  const URL = `http://${GRUSHER_IP}/api?cat=device&action=get_onu_info&param=${encodeURIComponent(
    serial
  )}`;

  try {
    const response = await axios.get(URL, {
      timeout: 30000,
      headers: { Accept: "application/json" },
    });

    const data = response.data;

    if (!data || typeof data.result !== "object" || !data.result) {
      await loggingSystem(
        "log/error.log",
        `Invalid Grusher response for serial ${serial}: ${JSON.stringify(data)}`
      );
      return null;
    }

    const onu = Object.values(data.result)[0];
    const ifaceName = onu?.iface_name;

    if (typeof ifaceName !== "string") {
      await loggingSystem(
        "log/error.log",
        `iface_name was not found for serial ${serial}: ${JSON.stringify(data)}`
      );
      return null;
    }

    const match = ifaceName.match(IFACE_NAME_REGEX);

    if (!match) {
      await loggingSystem(
        "log/error.log",
        `Unexpected iface_name format for serial ${serial}: ${ifaceName}`
      );
      return null;
    }

    const [, ponPort, ontNumber] = match;

    return `${ponPort} ont ${ontNumber}`;
  } catch (error) {
    let msg = "Unknown error";

    if (error.code === "ECONNABORTED") msg = "Request timeout";
    else if (error.response) msg = `${error.response.status} ${error.response.statusText}`;
    else msg = error.message;

    await loggingSystem("log/error.log", `Grusher API error (${serial}): ${msg}`);
    throw error;
  }
};
