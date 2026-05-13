import axios from 'axios';

const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_TOKEN;
export const DEFAULT_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

export const sendTelegramNotification = async (message, chatId = DEFAULT_CHAT_ID) => {
  if (!TELEGRAM_TOKEN || !chatId) {
    console.warn("Telegram Token or Chat ID not configured. Skipping notification.");
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    return response.data.ok;
  } catch (error) {
    console.error("Error sending Telegram notification:", error);
    return false;
  }
};

export const sendAccessNotification = async (user, success = true) => {
  const emoji = success ? '🔐' : '⚠️';
  const status = success ? 'EXITOSO' : 'FALLIDO';
  const message = `${emoji} <b>ACCESO AL SISTEMA</b>\n\n` +
                  `👤 <b>Personal:</b> ${user.jerarquía || ''} ${user.name}\n` +
                  `🕒 <b>Hora:</b> ${new Date().toLocaleTimeString()}\n` +
                  `📅 <b>Fecha:</b> ${new Date().toLocaleDateString()}\n` +
                  `🌐 <b>Estado:</b> ${status}`;
  return await sendTelegramNotification(message);
};

/**
 * Formateadores específicos para mantener estética premium
 */

export const sendEventNotification = async (event, isUpdate = false) => {
  const emoji = isUpdate ? '🔄' : '📅';
  const title = isUpdate ? 'EVENTO ACTUALIZADO' : 'NUEVO EVENTO AGENDADO';
  const message = `${emoji} <b>${title}</b>\n\n` +
                  `📌 <b>Título:</b> ${event.title}\n` +
                  `🕒 <b>Hora:</b> ${event.time} hs\n` +
                  `📅 <b>Fecha:</b> ${event.date}\n` +
                  `📝 <b>Tipo:</b> ${event.type}\n` +
                  `📖 <b>Notas:</b> ${event.description || 'Sin descripción'}`;
  return await sendTelegramNotification(message);
};

export const sendMtoNotification = async (mto, isUpdate = false) => {
  const emoji = mto.type === 'enviado' ? '📤' : '📥';
  const typeText = mto.type === 'enviado' ? 'SALIENTE' : 'ENTRANTE';
  const title = isUpdate ? 'MTO ACTUALIZADO' : 'NUEVO MTO REGISTRADO';
  
  let message = `${emoji} <b>${title} (${typeText})</b>\n\n` +
                `🔢 <b>MTO:</b> ${mto.prefix} ${mto.number}\n` +
                `📅 <b>Fecha:</b> ${mto.date}\n` +
                `📄 <b>Contenido:</b> ${mto.content}\n`;
  
  if (mto.hasDeadline) {
    message += `⚠️ <b>PLAZO:</b> ${mto.deadlineDate} ${mto.deadlineTime} hs`;
  }
  
  return await sendTelegramNotification(message);
};

export const sendReminderNotification = async (reminder, isUpdate = false) => {
  const emoji = '🔔';
  const title = isUpdate ? 'RECORDATORIO ACTUALIZADO' : 'NUEVO RECORDATORIO';
  const message = `${emoji} <b>${title}</b>\n\n` +
                  `📌 <b>Tema:</b> ${reminder.title}\n` +
                  `📅 <b>Programado para:</b> ${reminder.date} ${reminder.time} hs`;
  return await sendTelegramNotification(message);
};

export const sendInstitutionNotification = async (inst, isUpdate = false) => {
  const emoji = '🏢';
  const title = isUpdate ? 'INSTITUCIÓN ACTUALIZADA' : 'NUEVA INSTITUCIÓN REGISTRADA';
  
  const address = inst.address || `${inst.street || ''} ${inst.number || ''}, ${inst.locality || ''}`.trim();
  const phones = Array.isArray(inst.phones) ? inst.phones.filter(p => p).join(', ') : (inst.phones || 'No registrado');

  const message = `${emoji} <b>${title}</b>\n\n` +
                  `🏛️ <b>Nombre:</b> ${inst.name || 'Sin nombre'}\n` +
                  `👤 <b>Encargado:</b> ${inst.inCharge || 'No asignado'}\n` +
                  `📍 <b>Dirección:</b> ${address || 'No registrada'}\n` +
                  `📞 <b>Teléfonos:</b> ${phones}`;
  return await sendTelegramNotification(message);
};

export const sendPersonnelNotification = async (person, isUpdate = false) => {
  const emoji = '🎖️';
  const title = isUpdate ? 'PERSONAL ACTUALIZADO' : 'NUEVO PERSONAL REGISTRADO';
  const message = `${emoji} <b>${title}</b>\n\n` +
                  `👤 <b>Nombre:</b> ${person.name}\n` +
                  `🎖️ <b>Jerarquía:</b> ${person.hierarchy}\n` +
                  `🎂 <b>Cumpleaños:</b> ${person.birthDate}\n` +
                  `🆔 <b>MI:</b> ${person.mi}`;
  return await sendTelegramNotification(message);
};
