import { useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { sendTelegramNotification } from './telegram';
import { format, parseISO, differenceInYears, addDays } from 'date-fns';

export const useNotificationScheduler = () => {
  useEffect(() => {
    const checkNotifications = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');
      const timeStr = format(now, 'HH:mm');
      const currentMonthDay = format(now, 'MM-dd');
      const tomorrowMonthDay = format(addDays(now, 1), 'MM-dd');

      // 1. AGENDA JEFATURA
      try {
        const allEvents = await getDocs(collection(db, 'events'));
        for (const d of allEvents.docs) {
          const event = d.data();
          const eventDate = event.date;
          const eventTime = (event.time || '08:00').trim();

          if (eventDate === todayStr && !event.notified && eventTime <= timeStr) {
            await updateDoc(doc(db, 'events', d.id), { notified: true });
            await sendTelegramNotification(
              `📅 <b>[AGENDA JEFATURA] - AVISO DE HOY</b>\n\n` +
              `📌 <b>Evento:</b> ${event.title}\n` +
              `🕒 <b>Hora:</b> ${eventTime} hs\n` +
              `📝 <b>Detalles:</b> ${event.description || 'Sin descripción'}`
            );
          } else if (eventDate === tomorrowStr && !event.notified24h && eventTime <= timeStr) {
            await updateDoc(doc(db, 'events', d.id), { notified24h: true });
            await sendTelegramNotification(
              `⏳ <b>[AGENDA JEFATURA] - FALTAN 24HS</b>\n\n` +
              `📌 <b>Evento Mañana:</b> ${event.title}\n` +
              `🕒 <b>Hora:</b> ${eventTime} hs\n` +
              `⚠️ <i>Recordatorio programado.</i>`
            );
          }
        }
      } catch (e) { console.error("Error in Agenda Scheduler:", e); }

      // 2. REGISTRO MTO
      try {
        const allMtos = await getDocs(collection(db, 'mtos'));
        for (const d of allMtos.docs) {
          const mto = d.data();
          if (!mto.hasDeadline) continue;
          const dDate = mto.deadlineDate;
          const dTime = (mto.deadlineTime || '23:59').trim();

          if (dDate === todayStr && !mto.notified && dTime <= timeStr) {
            await updateDoc(doc(db, 'mtos', d.id), { notified: true });
            await sendTelegramNotification(
              `📤 <b>[REGISTRO MTO] - VENCIMIENTO HOY</b>\n\n` +
              `🔢 <b>Nro:</b> ${mto.prefix} ${mto.number}\n` +
              `🕒 <b>Plazo Final:</b> ${dDate} ${dTime} hs\n` +
              `📄 <b>Contenido:</b> ${mto.content}`
            );
          } else if (dDate === tomorrowStr && !mto.notified24h && dTime <= timeStr) {
            await updateDoc(doc(db, 'mtos', d.id), { notified24h: true });
            await sendTelegramNotification(
              `🕒 <b>[REGISTRO MTO] - FALTAN 24HS</b>\n\n` +
              `🔢 <b>Nro:</b> ${mto.prefix} ${mto.number}\n` +
              `📅 <b>Vence:</b> ${dDate} a las ${dTime} hs`
            );
          }
        }
      } catch (e) { console.error("Error in MTO Scheduler:", e); }

      // 3. CUMPLEAÑOS PERSONAL
      try {
        const personnelSnap = await getDocs(collection(db, 'personnel'));
        for (const d of personnelSnap.docs) {
          const p = d.data();
          if (!p.birthDate) continue;

          const birthDate = parseISO(p.birthDate);
          if (isNaN(birthDate.getTime())) continue;

          const bMonthDay = format(birthDate, 'MM-dd');
          const pNotifyTime = (p.notificationTime || '08:00').trim();
          
          if (bMonthDay === currentMonthDay && p.lastNotifiedDate !== todayStr && pNotifyTime <= timeStr) {
            const age = differenceInYears(now, birthDate);
            await updateDoc(doc(db, 'personnel', d.id), { lastNotifiedDate: todayStr });
            await sendTelegramNotification(
              `🎂 <b>[CUMPLEAÑOS PERSONAL] - AVISO DE HOY</b>\n\n` +
              `🎖️ <b>Jerarquía:</b> ${p.hierarchy}\n` +
              `👤 <b>Nombre:</b> ${p.name}\n` +
              `🎈 Cumple: <b>${age} años</b>\n` +
              `🎊 ¡Felicite al personal en su día!`
            );
          } else if (bMonthDay === tomorrowMonthDay && p.lastNotifiedDate24h !== todayStr && pNotifyTime <= timeStr) {
            const nextAge = differenceInYears(addDays(now, 1), birthDate);
            await updateDoc(doc(db, 'personnel', d.id), { lastNotifiedDate24h: todayStr });
            await sendTelegramNotification(
              `🎁 <b>[CUMPLEAÑOS PERSONAL] - MAÑANA CUMPLEAÑOS</b>\n\n` +
              `🎖️ <b>Jerarquía:</b> ${p.hierarchy}\n` +
              `👤 <b>Nombre:</b> ${p.name}\n` +
              `🎂 Mañana cumple: <b>${nextAge} años</b>`
            );
          }
        }
      } catch (e) { console.error("Error in Birthday Scheduler:", e); }

      // 4. RECORDATORIO
      try {
        const remindersSnap = await getDocs(collection(db, 'reminders'));
        for (const d of remindersSnap.docs) {
          const rem = d.data();
          const remDate = rem.date;
          const remTime = (rem.time || '08:00').trim();

          if (remDate === todayStr && !rem.notified && remTime <= timeStr) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rem.content || rem.title;
            const plainContent = tempDiv.innerText || tempDiv.textContent || "";

            await deleteDoc(doc(db, 'reminders', d.id));
            await sendTelegramNotification(
              `🔔 <b>[RECORDATORIO] - AVISO FINAL</b>\n\n` +
              `📌 <b>Título:</b> ${rem.title}\n` +
              `🕒 <b>Hora:</b> ${remTime} hs\n\n` +
              `📄 <b>Nota:</b> ${plainContent}`
            );
          } else if (remDate === tomorrowStr && !rem.notified24h && remTime <= timeStr) {
            await updateDoc(doc(db, 'reminders', d.id), { notified24h: true });
            await sendTelegramNotification(
              `📅 <b>[RECORDATORIO] - FALTAN 24HS</b>\n\n` +
              `📌 <b>Tema:</b> ${rem.title}\n` +
              `🕒 <b>Mañana a las:</b> ${remTime} hs`
            );
          }
        }
      } catch (e) { console.error("Error in Reminder Scheduler:", e); }

      // 5. INSTITUCIÓN
      try {
        const instSnap = await getDocs(collection(db, 'institutions'));
        for (const d of instSnap.docs) {
          const inst = d.data();
          if (!inst.creationDate) continue;

          const creationDate = parseISO(inst.creationDate);
          if (isNaN(creationDate.getTime())) continue;

          const iMonthDay = format(creationDate, 'MM-dd');
          const iNotifyTime = (inst.notificationTime || '08:30').trim();
          const currentYear = todayStr.substring(0, 4);
          
          if (iMonthDay === currentMonthDay && inst.lastNotifiedYear !== currentYear && timeStr >= iNotifyTime) {
            await updateDoc(doc(db, 'institutions', d.id), { lastNotifiedYear: currentYear });
            await sendTelegramNotification(
              `🎖️ <b>[INSTITUCIÓN] - ANIVERSARIO HOY</b>\n\n` +
              `🏛️ <b>Nombre:</b> ${inst.name}\n` +
              `🎊 ¡Felicidades por un nuevo año de servicio!`
            );
          } else if (iMonthDay === tomorrowMonthDay && inst.lastNotifiedYear24h !== currentYear && timeStr >= iNotifyTime) {
            await updateDoc(doc(db, 'institutions', d.id), { lastNotifiedYear24h: currentYear });
            await sendTelegramNotification(
              `🏛️ <b>[INSTITUCIÓN] - MAÑANA ANIVERSARIO</b>\n\n` +
              `🏛️ <b>Nombre:</b> ${inst.name}\n` +
              `📅 Mañana se cumple el aniversario institucional.`
            );
          }
        }
      } catch (e) { console.error("Error in Institution Scheduler:", e); }
    };

    const interval = setInterval(checkNotifications, 60000);
    checkNotifications();

    return () => clearInterval(interval);
  }, []);
};
