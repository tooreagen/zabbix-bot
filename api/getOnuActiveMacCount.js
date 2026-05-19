import axios from "axios";
import { loggingSystem } from "../helpers/loggingSystem.js";

const { GRUSHER_IP } = process.env;

/**
 * Получение количества активных МАС-адресов на ONU за последний месяц, используя API Грушера
 * @param {*} SN - серийный номер ОНУ
 * @returns {number|null} - количество активных МАС-адресов или null в случае ошибки или если ОНУ не найдена в базе Грушера
 */
export const getOnuActiveMacCount = async (SN) => {
  const URL = `http://${GRUSHER_IP}/api?cat=db&action=get_mac_history_on_onu&onu_name=${encodeURIComponent(SN)}`;

  try {
    const response = await axios.get(URL, {
      timeout: 30000,
      headers: { Accept: "application/json" },
    });

    const data = response.data;

    // Если data.result === null, значит ОНУ не была найдена в базе Грушера - возвращаем null
    if (data.result === null) {
      return null;
    }

    // Если data.result не массив, значит ответ от Грушера не соответствует ожидаемому формату - возвращаем null
    if (!data || !Array.isArray(data.result)) {
      return null;
    }

    //Фильтруем МАС-адреса (updated_at), если был за последний месяц, то добавляем к счетчику, если нет - не учитываем
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentMacs = data.result.filter((entry) => {
      const updatedAt = new Date(entry.updated_at).getTime();
      return updatedAt >= oneMonthAgo;
    });

    
    return recentMacs.length;
  } catch (error) {
    await loggingSystem("log/error.log", `Grusher API error: ${error.message}`);
    throw error;
  }
};
