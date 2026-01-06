import fs from "fs";
import path from "path";
import moment from "moment";

export const loggingSystem = async (fileName, msg) => {
  try {
    //Получаем корневой каталог проекта (при необходимости можно задать путь вручную)
    const projectRoot = process.cwd(); //это текущий рабочий каталог

    //Якщо шлях відносний, робимо його абсолютним щодо кореня проєкту
    const absoluteFilePath = path.isAbsolute(fileName)
      ? fileName
      : path.resolve(projectRoot, fileName);

    const logDir = path.dirname(absoluteFilePath);
    await fs.promises.mkdir(logDir, { recursive: true });

    const currentDate = moment().format("DD-MM-YYYY HH:mm:ss");
    const message = `${currentDate} ${msg}\n`;

    await fs.promises.appendFile(absoluteFilePath, message);
    console.log(message);
  } catch (error) {
    console.error("Logging error:", error);
  }
};
