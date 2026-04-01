import "dotenv/config";
import cron from "node-cron";
import { bot } from "./bot.js";
import { getOnuCliMacCount } from "./api/getOnuCliMacCount.js";
import { getOnuPathFromGrusher } from "./api/getOnuPathFromGrusher.js";
import { onuSerials } from "./data/onuSerials.js";
import { loggingSystem } from "./helpers/loggingSystem.js";

const logOnuPaths = async () => {
  for (const serial of onuSerials) {
    try {
      const onuPath = await getOnuPathFromGrusher(serial);
      console.log(`${serial}: ${onuPath}`);
    } catch (error) {
      await loggingSystem(
        "log/error.log",
        `Failed to get ONU path for ${serial}: ${error.message}`,
      );
    }
  }
};

await logOnuPaths();

cron.schedule("*/1 * * * *", async () => {
  const GRUSHER_ONU_PATH = "0/4/5 ont 6";
  try {
    const data = await getOnuCliMacCount(GRUSHER_ONU_PATH);
    console.log(`${GRUSHER_ONU_PATH}: ${JSON.stringify(data)}`);
  } catch (error) {
    await loggingSystem(
      "log/error.log",
      `Grusher cron job failed for ${GRUSHER_ONU_PATH}: ${error.message}`,
    );
  }
});

// bot.start();

console.log("Bot started");
