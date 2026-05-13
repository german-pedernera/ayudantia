import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { format, parseISO, differenceInYears, addDays } from 'date-fns';
import axios from 'axios';
import fs from 'fs';

// Manually load .env since we can't install dotenv in this sandbox easily
try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
    console.log("✅ Configuración cargada desde .env");
} catch (err) {
    console.error("❌ No se pudo encontrar el archivo .env");
}

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TELEGRAM_TOKEN = process.env.VITE_TELEGRAM_TOKEN;
const CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID;

const sendTelegram = async (message) => {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`🚀 Notificación enviada: ${message.substring(0, 30)}...`);
    } catch (error) {
        console.error("❌ Error enviando a Telegram:", error.message);
    }
};

const checkNotifications = async () => {
    console.log(`🔍 Ejecutando chequeo: ${new Date().toLocaleString()}`);
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
                await sendTelegram(`📅 <b>[AGENDA JEFATURA] - HOY</b>\n\n📌 <b>Evento:</b> ${event.title}\n🕒 <b>Hora:</b> ${eventTime} hs\n📝 <b>Detalles:</b> ${event.description || 'Sin descripción'}`);
            } else if (eventDate === tomorrowStr && !event.notified24h && eventTime <= timeStr) {
                await updateDoc(doc(db, 'events', d.id), { notified24h: true });
                await sendTelegram(`⏳ <b>[AGENDA JEFATURA] - MAÑANA</b>\n\n📌 <b>Evento Mañana:</b> ${event.title}\n🕒 <b>Hora:</b> ${eventTime} hs`);
            }
        }
    } catch (e) { console.error("Error Agenda:", e); }

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
                await sendTelegram(`📤 <b>[MTO] - VENCE HOY</b>\n\n🔢 <b>Nro:</b> ${mto.prefix} ${mto.number}\n🕒 <b>Plazo:</b> ${dDate} ${dTime} hs\n📄 <b>Contenido:</b> ${mto.content}`);
            } else if (dDate === tomorrowStr && !mto.notified24h && dTime <= timeStr) {
                await updateDoc(doc(db, 'mtos', d.id), { notified24h: true });
                await sendTelegram(`🕒 <b>[MTO] - MAÑANA VENCE</b>\n\n🔢 <b>Nro:</b> ${mto.prefix} ${mto.number}\n📅 <b>Vence:</b> ${dDate} ${dTime} hs`);
            }
        }
    } catch (e) { console.error("Error MTO:", e); }

    // 3. CUMPLEAÑOS
    try {
        const personnelSnap = await getDocs(collection(db, 'personnel'));
        for (const d of personnelSnap.docs) {
            const p = d.data();
            if (!p.birthDate) continue;
            const birthDate = parseISO(p.birthDate);
            const bMonthDay = format(birthDate, 'MM-dd');
            const pNotifyTime = (p.notificationTime || '08:00').trim();
            
            if (bMonthDay === currentMonthDay && p.lastNotifiedDate !== todayStr && pNotifyTime <= timeStr) {
                const age = differenceInYears(now, birthDate);
                await updateDoc(doc(db, 'personnel', d.id), { lastNotifiedDate: todayStr });
                await sendTelegram(`🎂 <b>[CUMPLEAÑOS] - HOY</b>\n\n🎖️ <b>Jerarquía:</b> ${p.hierarchy}\n👤 <b>Nombre:</b> ${p.name}\n🎈 Cumple: <b>${age} años</b>`);
            } else if (bMonthDay === tomorrowMonthDay && p.lastNotifiedDate24h !== todayStr && pNotifyTime <= timeStr) {
                const nextAge = differenceInYears(addDays(now, 1), birthDate);
                await updateDoc(doc(db, 'personnel', d.id), { lastNotifiedDate24h: todayStr });
                await sendTelegram(`🎁 <b>[CUMPLEAÑOS] - MAÑANA</b>\n\n🎖️ <b>Jerarquía:</b> ${p.hierarchy}\n👤 <b>Nombre:</b> ${p.name}\n🎂 Mañana cumple: <b>${nextAge} años</b>`);
            }
        }
    } catch (e) { console.error("Error Cumples:", e); }

    // 4. RECORDATORIOS
    try {
        const remindersSnap = await getDocs(collection(db, 'reminders'));
        for (const d of remindersSnap.docs) {
            const rem = d.data();
            const remDate = rem.date;
            const remTime = (rem.time || '08:00').trim();

            if (remDate === todayStr && !rem.notified && remTime <= timeStr) {
                await deleteDoc(doc(db, 'reminders', d.id));
                await sendTelegram(`🔔 <b>[RECORDATORIO]</b>\n\n📌 <b>Título:</b> ${rem.title}\n🕒 <b>Hora:</b> ${remTime} hs\n📄 <b>Nota:</b> ${rem.content || ''}`);
            } else if (remDate === tomorrowStr && !rem.notified24h && remTime <= timeStr) {
                await updateDoc(doc(db, 'reminders', d.id), { notified24h: true });
                await sendTelegram(`📅 <b>[RECORDATORIO] - MAÑANA</b>\n\n📌 <b>Tema:</b> ${rem.title}\n🕒 <b>Mañana:</b> ${remTime} hs`);
            }
        }
    } catch (e) { console.error("Error Recordatorios:", e); }

    // 5. ANIVERSARIOS
    try {
        const instSnap = await getDocs(collection(db, 'institutions'));
        for (const d of instSnap.docs) {
            const inst = d.data();
            if (!inst.creationDate) continue;
            const creationDate = parseISO(inst.creationDate);
            const iMonthDay = format(creationDate, 'MM-dd');
            const iNotifyTime = (inst.notificationTime || '08:30').trim();
            const currentYear = todayStr.substring(0, 4);
            
            if (iMonthDay === currentMonthDay && inst.lastNotifiedYear !== currentYear && timeStr >= iNotifyTime) {
                await updateDoc(doc(db, 'institutions', d.id), { lastNotifiedYear: currentYear });
                await sendTelegram(`🎖️ <b>[ANIVERSARIO] - HOY</b>\n\n🏛️ <b>Nombre:</b> ${inst.name}\n🎊 ¡Felicidades por un nuevo año!`);
            }
        }
    } catch (e) { console.error("Error Instituciones:", e); }
};

// Run every 5 minutes
setInterval(checkNotifications, 300000);
checkNotifications();

console.log("🟢 Standalone Telegram Bot iniciado...");
console.log("Presione Ctrl+C para detener.");
