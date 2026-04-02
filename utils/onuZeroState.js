import fs from "fs/promises";
import path from "path";

const ONU_ZERO_STATE_FILE = path.resolve(process.cwd(), "data", "onuZeroState.json");

export const loadOnuZeroState = async () => {
  try {
    const raw = await fs.readFile(ONU_ZERO_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
};

export const saveOnuZeroState = async (state) => {
  await fs.mkdir(path.dirname(ONU_ZERO_STATE_FILE), { recursive: true });
  await fs.writeFile(ONU_ZERO_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};
