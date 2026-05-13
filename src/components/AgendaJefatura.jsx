import { useState, useEffect } from 'react';
import { 
  Plus, Clock, Trash2, Edit2,
  Save, Share2, FileText, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, 
  eachDayOfInterval 
} from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query } from 'firebase/firestore';
import { 
  sendEventNotification, 
  sendPersonnelNotification, 
  sendInstitutionNotification, 
  sendMtoNotification, 
  sendReminderNotification 
} from '../services/telegram';
import Swal from 'sweetalert2';


const AgendaJefatura = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    time: '09:00',
    type: 'reunion',
    description: ''
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [eventsSnap, personnelSnap, institutionsSnap, mtosSnap, remindersSnap] = await Promise.all([
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'personnel')),
        getDocs(collection(db, 'institutions')),
        getDocs(collection(db, 'mtos')),
        getDocs(collection(db, 'reminders'))
      ]);

      const currentYear = format(currentDate, 'yyyy');

      const eventsList = eventsSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        source: 'events'
      }));

      const birthdaysList = personnelSnap.docs.map(doc => {
        const p = doc.data();
        if (!p.birthDate || p.birthDate.length < 10) return null;
        const birthdayMonthDay = p.birthDate.substring(5);
        return {
          id: `birth-${doc.id}`,
          title: `Cumpleaños: ${p.hierarchy} ${p.name}`,
          date: `${currentYear}-${birthdayMonthDay}`,
          birthDate: p.birthDate,
          time: p.notificationTime || '08:00',
          type: 'cumpleaños',
          hierarchy: p.hierarchy,
          mi: p.mi || '',
          ce: p.ce || '',
          phone: p.phone || '',
          civilStatus: p.civilStatus || 'soltero',
          description: `MI: ${p.mi || ''} | CE: ${p.ce || ''} | Tel: ${p.phone || ''}`,
          source: 'personnel',
          readOnly: true
        };
      }).filter(Boolean);

      const anniversariesList = institutionsSnap.docs.map(doc => {
        const i = doc.data();
        if (!i.creationDate || i.creationDate.length < 10) return null;
        const anniversaryMonthDay = i.creationDate.substring(5);
        return {
          id: `anniv-${doc.id}`,
          title: `Aniversario: ${i.name}`,
          date: `${currentYear}-${anniversaryMonthDay}`,
          creationDate: i.creationDate,
          time: i.notificationTime || '08:00',
          type: 'aniversario',
          instType: i.type || '',
          location: i.location || '',
          description: `Tipo: ${i.type || ''} | Ubicación: ${i.location || ''}`,
          source: 'institutions',
          readOnly: true
        };
      }).filter(Boolean);

      const mtosList = mtosSnap.docs
        .filter(doc => doc.data().hasDeadline)
        .map(doc => {
          const m = doc.data();
          return {
            id: `mto-${doc.id}`,
            title: `Plazo MTO: ${m.prefix} ${m.number}`,
            date: m.date,
            deadlineDate: m.deadlineDate,
            time: m.deadlineTime || '23:59',
            type: 'mto',
            mtoType: m.type || 'recibido',
            prefix: m.prefix || '',
            number: m.number || '',
            description: m.content,
            source: 'mtos',
            readOnly: true,
            notified: m.notified,
            completed: m.completed,
            hasDeadline: true
          };
        });

      const remindersList = remindersSnap.docs.map(doc => {
        const r = doc.data();
        return {
          id: `rem-${doc.id}`,
          title: `Recordatorio: ${r.title}`,
          date: r.date,
          time: r.time,
          type: 'recordatorio',
          description: '',
          source: 'reminders',
          readOnly: true,
          notified: r.notified
        };
      });

      setEvents([
        ...eventsList, 
        ...birthdaysList, 
        ...anniversariesList, 
        ...mtosList, 
        ...remindersList
      ]);
    } catch (error) {
      console.error("Error fetching all events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const handleSaveEvent = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      const id = editingEvent?.id;
      
      if (id?.startsWith('birth-')) {
        const realId = id.replace('birth-', '');
        await updateDoc(doc(db, 'personnel', realId), { 
          hierarchy: newEvent.hierarchy,
          name: newEvent.title.replace('Cumpleaños: ', ''),
          birthDate: newEvent.birthDate,
          mi: newEvent.mi,
          ce: newEvent.ce,
          phone: newEvent.phone,
          civilStatus: newEvent.civilStatus,
          notificationTime: newEvent.time
        });
      } else if (id?.startsWith('anniv-')) {
        const realId = id.replace('anniv-', '');
        await updateDoc(doc(db, 'institutions', realId), { 
          name: newEvent.title.replace('Aniversario: ', ''),
          type: newEvent.instType,
          creationDate: newEvent.creationDate,
          location: newEvent.location,
          notificationTime: newEvent.time
        });
      } else if (id?.startsWith('mto-')) {
        const realId = id.replace('mto-', '');
        await updateDoc(doc(db, 'mtos', realId), { 
          type: newEvent.mtoType || 'recibido',
          date: newEvent.date,
          prefix: newEvent.prefix,
          number: newEvent.number,
          content: newEvent.description,
          deadlineDate: newEvent.deadlineDate,
          deadlineTime: newEvent.time
        });
      } else if (id?.startsWith('rem-')) {
        const realId = id.replace('rem-', '');
        await updateDoc(doc(db, 'reminders', realId), { 
          title: newEvent.title.replace('Recordatorio: ', ''),
          content: newEvent.title.replace('Recordatorio: ', ''),
          date: newEvent.date,
          time: newEvent.time
        });
      } else {
        if (newEvent.type === 'cumpleaños' && !editingEvent) {
        const personData = {
          hierarchy: newEvent.hierarchy,
          name: newEvent.title,
          birthDate: newEvent.birthDate || format(selectedDate, 'yyyy-MM-dd'),
          mi: newEvent.mi || '',
          ce: newEvent.ce || '',
          phone: newEvent.phone || '',
          civilStatus: newEvent.civilStatus || 'soltero',
          notificationTime: newEvent.time || '08:00'
        };
        await addDoc(collection(db, 'personnel'), personData);
        await sendPersonnelNotification(personData, false);
        } else if (newEvent.type === 'aniversario' && !editingEvent) {
        const instData = {
          name: newEvent.title,
          type: newEvent.instType || '',
          location: newEvent.location || '',
          creationDate: newEvent.creationDate || format(selectedDate, 'yyyy-MM-dd'),
          notificationTime: newEvent.time || '08:30'
        };
        await addDoc(collection(db, 'institutions'), instData);
        await sendInstitutionNotification(instData, false);
        } else if (newEvent.type === 'mto' && !editingEvent) {
        const mtoData = {
          type: newEvent.mtoType || 'recibido',
          date: newEvent.date || format(selectedDate, 'yyyy-MM-dd'),
          prefix: newEvent.prefix || '',
          number: newEvent.number || '',
          content: newEvent.description || '',
          hasDeadline: newEvent.hasDeadline !== false,
          deadlineDate: newEvent.hasDeadline !== false ? (newEvent.deadlineDate || format(selectedDate, 'yyyy-MM-dd')) : '',
          deadlineTime: newEvent.hasDeadline !== false ? (newEvent.time || '23:59') : '',
          notified: false
        };
        await addDoc(collection(db, 'mtos'), mtoData);
        await sendMtoNotification(mtoData, false);
        } else if (newEvent.type === 'recordatorio' && !editingEvent) {
        const res = await addDoc(collection(db, 'reminders'), {
          title: newEvent.title,
          content: newEvent.title,
          date: newEvent.date || format(selectedDate, 'yyyy-MM-dd'),
          time: newEvent.time || '08:00',
          notified: false,
          priority: 'media'
        });
        await sendReminderNotification({ 
          title: newEvent.title, 
          date: newEvent.date || format(selectedDate, 'yyyy-MM-dd'), 
          time: newEvent.time || '08:00' 
        }, false);
        } else {
          const eventData = {
            ...newEvent,
            date: newEvent.date || format(selectedDate, 'yyyy-MM-dd'),
            notified: false
          };
          if (editingEvent) {
            await updateDoc(doc(db, 'events', editingEvent.id), eventData);
            await sendEventNotification(eventData, true);
          } else {
            await addDoc(collection(db, 'events'), eventData);
            await sendEventNotification(eventData, false);
          }
        }
      }

      if (!editingEvent) {
        if (newEvent.type === 'cumpleaños') await sendPersonnelNotification(newEvent, false);
        else if (newEvent.type === 'aniversario') await sendInstitutionNotification(newEvent, false);
        else if (newEvent.type === 'mto') await sendMtoNotification(newEvent, false);
        else if (newEvent.type === 'recordatorio') await sendReminderNotification(newEvent, false);
        else await sendEventNotification(newEvent, false);
      } else {
        if (newEvent.type === 'reunion' || newEvent.type === 'evento') {
          await sendEventNotification(newEvent, true);
        }
      }

      setShowForm(false);
      setEditingEvent(null);
      setNewEvent({ title: '', time: '09:00', type: 'reunion', description: '' });
      fetchEvents();
    } catch (error) {
      console.error("Error saving record:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (event) => {
    const result = await Swal.fire({
      title: '¿Eliminar este registro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    
    try {
      const id = event.id;
      if (id.startsWith('birth-')) {
        await deleteDoc(doc(db, 'personnel', id.replace('birth-', '')));
      } else if (id.startsWith('anniv-')) {
        await deleteDoc(doc(db, 'institutions', id.replace('anniv-', '')));
      } else if (id.startsWith('mto-')) {
        await deleteDoc(doc(db, 'mtos', id.replace('mto-', '')));
      } else if (id.startsWith('rem-')) {
        await deleteDoc(doc(db, 'reminders', id.replace('rem-', '')));
      } else {
        await deleteDoc(doc(db, 'events', id));
      }
      fetchEvents();
      if (getDayEvents(selectedDate).length <= 1) setShowModal(false);
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const monthYear = format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase();
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(11, 51, 31);
    doc.text('CRONOGRAMA DE ACTIVIDADES', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(monthYear, 105, 25, { align: 'center' });
    
    const filteredEvents = events
      .filter(e => {
        const eventDate = new Date(e.date + 'T00:00:00');
        return isSameMonth(eventDate, currentDate);
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

    // Function to clean emojis and special characters for PDF
    const cleanText = (str) => {
      if (!str) return '';
      return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
                .replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, ''); // Keep common Spanish chars, remove others
    };

    const tableData = filteredEvents.map(e => [
      format(new Date(e.date + 'T00:00:00'), 'dd/MM/yyyy'), 
      e.time, 
      cleanText(e.title), 
      e.type.charAt(0).toUpperCase() + e.type.slice(1), 
      cleanText(e.description) || '-'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Fecha', 'Hora', 'Título', 'Tipo', 'Descripción']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 51, 31], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 'auto' }
      }
    });
    
    doc.save(`agenda_${format(currentDate, 'MM-yyyy')}.pdf`);
  };

  const shareOnWhatsApp = (event) => {
    const text = `Agenda GNA: ${event.title} - Fecha: ${event.date} Hora: ${event.time}. ${event.description}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayEvents = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.date === dayStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border-2 border-slate-300">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors">
            <ChevronLeft size={20} className="text-slate-900" />
          </button>
          <h2 className="text-xl font-black px-4 min-w-[200px] text-center text-slate-900">
            {format(currentDate, 'MMMM yyyy', { locale: es }).toUpperCase()}
          </h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-sky-50 rounded-xl transition-colors">
            <ChevronRight size={20} className="text-slate-900" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="p-3 bg-white border-2 border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-slate-900">
            <FileText size={20} />
          </button>
          <button onClick={() => { setShowForm(true); setEditingEvent(null); }} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            <span>Nuevo Evento</span>
          </button>
        </div>
      </div>

      <div className="project-card p-6 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-3xl">
            <div className="w-12 h-12 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded-xl overflow-hidden">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="bg-sky-50 p-4 text-center text-sm font-black text-slate-500 uppercase tracking-wider border-r border-b border-slate-200">
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const dayEvents = getDayEvents(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={idx}
                onClick={() => {
                  setSelectedDate(day);
                  if (dayEvents.length > 0) setShowModal(true);
                  else setShowForm(true);
                }}
                className={`min-h-[120px] p-2 transition-all cursor-pointer relative group border-r border-b border-slate-200 ${
                  !isCurrentMonth 
                    ? 'bg-slate-100/80 text-slate-400' 
                    : 'bg-white'
                } ${isSelected ? 'ring-2 ring-inset ring-project-500 z-10' : ''} ${
                  dayEvents.length > 0 && isCurrentMonth ? 'bg-sky-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-project-600 text-white shadow-md' : 'text-slate-900'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 2).map((event, i) => (
                    <div key={i} className={`text-[10px] p-1 rounded truncate border font-black ${
                      event.type === 'cumpleaños' ? 'bg-pink-100 text-pink-800 border-pink-200' :
                      event.type === 'aniversario' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      event.type === 'mto' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      event.type === 'recordatorio' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                      'bg-sky-100 text-project-800 border-sky-200'
                    }`}>
                      {event.time} - {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-slate-400 pl-1 font-medium">
                      + {dayEvents.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {(showForm || showModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg project-card m-2 sm:m-4 max-h-[95vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {showForm ? (editingEvent ? 'Editar Evento' : 'Nuevo Evento') : 'Eventos del Día'}
                </h3>
                <button onClick={() => { setShowForm(false); setShowModal(false); setEditingEvent(null); }} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                {showForm ? (
                  <form onSubmit={handleSaveEvent} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Tipo de Registro</label>
                      <select 
                        className="input-field"
                        value={newEvent.type}
                        onChange={(e) => setNewEvent({...newEvent, type: e.target.value, title: '', description: ''})}
                      >
                        <option value="reunion de trabajo">Reunión de Trabajo</option>
                        <option value="desayuno de trabajo">Desayuno de Trabajo</option>
                        <option value="almuerzo de trabajo">Almuerzo de Trabajo</option>
                        <option value="cena de trabajo">Cena de Trabajo</option>
                        <option value="cumpleaños">Cumpleaños Personal</option>
                        <option value="aniversario">Institución / Aniversario</option>
                        <option value="mto">Registro MTO (Plazo)</option>
                        <option value="recordatorio">Recordatorio / Nota</option>
                      </select>
                    </div>

                    {newEvent.type === 'cumpleaños' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Jerarquía</label>
                          <select className="input-field" value={newEvent.hierarchy || ''} onChange={(e) => setNewEvent({...newEvent, hierarchy: e.target.value})} required>
                            <option value="">Seleccione...</option>
                            {hierarchies.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Nombre y Apellido</label>
                          <input className="input-field" placeholder="Ej. Juan Perez" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Fecha de Nacimiento</label>
                          <input type="date" className="input-field" value={newEvent.birthDate || format(selectedDate, 'yyyy-MM-dd')} onChange={(e) => setNewEvent({...newEvent, birthDate: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">MI (DNI)</label>
                          <input className="input-field" value={newEvent.mi || ''} onChange={(e) => setNewEvent({...newEvent, mi: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">CE (Código Estadístico)</label>
                          <input className="input-field" value={newEvent.ce || ''} onChange={(e) => setNewEvent({...newEvent, ce: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Teléfono Particular</label>
                          <input className="input-field" placeholder="Ej. +54 9 11..." value={newEvent.phone || ''} onChange={(e) => setNewEvent({...newEvent, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Estado Civil</label>
                          <select className="input-field" value={newEvent.civilStatus || 'soltero'} onChange={(e) => setNewEvent({...newEvent, civilStatus: e.target.value})}>
                            <option value="soltero">Soltero/a</option>
                            <option value="casado">Casado/a</option>
                            <option value="union convivencial">Unión Convivencial</option>
                            <option value="viudo">Viudo/a</option>
                            <option value="divorciado">Divorciado/a</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Horario de Aviso (Telegram)</label>
                          <input type="time" className="input-field" value={newEvent.time || '08:00'} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                      </div>
                    )}

                    {newEvent.type === 'aniversario' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Nombre de Institución</label>
                          <input className="input-field" placeholder="Ej. Escuadrón 10" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Tipo</label>
                          <select className="input-field" value={newEvent.instType || ''} onChange={(e) => setNewEvent({...newEvent, instType: e.target.value})} required>
                            <option value="">Seleccione...</option>
                            <option value="Escuadrón">Escuadrón</option>
                            <option value="Sección">Sección</option>
                            <option value="Grupo">Grupo</option>
                            <option value="Puesto">Puesto</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Fecha de Creación</label>
                          <input type="date" className="input-field" value={newEvent.creationDate || format(selectedDate, 'yyyy-MM-dd')} onChange={(e) => setNewEvent({...newEvent, creationDate: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Ubicación / Ciudad</label>
                          <input className="input-field" value={newEvent.location || ''} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Aviso Telegram</label>
                          <input type="time" className="input-field" value={newEvent.time || '08:30'} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                        </div>
                      </div>
                    )}

                    {newEvent.type === 'mto' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Tipo</label>
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                              <button type="button" onClick={() => setNewEvent({...newEvent, mtoType: 'recibido'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newEvent.mtoType !== 'enviado' ? 'bg-white shadow-sm text-project-600' : 'text-slate-400'}`}>RECIBIDO</button>
                              <button type="button" onClick={() => setNewEvent({...newEvent, mtoType: 'enviado'})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newEvent.mtoType === 'enviado' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>ENVIADO</button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Fecha MTO</label>
                            <input type="date" className="input-field" value={newEvent.date || format(selectedDate, 'yyyy-MM-dd')} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input className="input-field uppercase" placeholder="Prefijo" value={newEvent.prefix || ''} onChange={(e) => setNewEvent({...newEvent, prefix: e.target.value.toUpperCase()})} />
                          <input className="input-field" placeholder="Número" value={newEvent.number || ''} onChange={(e) => setNewEvent({...newEvent, number: e.target.value})} />
                        </div>
                        <textarea className="input-field h-24 resize-none" placeholder="Contenido / Reseña" value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} required />
                        
                        <div className="space-y-3 p-4 bg-sky-50 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold">¿Tiene plazo de cumplimiento?</label>
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 rounded-md border-slate-300 text-project-600 focus:ring-project-500" 
                              checked={newEvent.hasDeadline !== false}
                              onChange={(e) => setNewEvent({...newEvent, hasDeadline: e.target.checked})}
                            />
                          </div>
                          {(newEvent.hasDeadline !== false) && (
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Fecha Plazo</label>
                                <input type="date" className="input-field" value={newEvent.deadlineDate || format(selectedDate, 'yyyy-MM-dd')} onChange={(e) => setNewEvent({...newEvent, deadlineDate: e.target.value})} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium">Hora Plazo</label>
                                <input type="time" className="input-field" value={newEvent.time || '23:59'} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {newEvent.type === 'recordatorio' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-bold">Tema a recordar</label>
                          <textarea className="input-field h-32 resize-none" placeholder="Ej. Realizar relevamiento..." value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-bold">Fecha</label>
                            <input type="date" className="input-field" value={newEvent.date || format(selectedDate, 'yyyy-MM-dd')} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} required />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-bold">Hora</label>
                            <input type="time" className="input-field" value={newEvent.time || '08:00'} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} required />
                          </div>
                        </div>
                      </div>
                    )}

                    {!['cumpleaños', 'aniversario', 'mto', 'recordatorio'].includes(newEvent.type) && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Título del Evento</label>
                          <input 
                            className="input-field"
                            placeholder="Ej. Reunión de Jefes..."
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Hora</label>
                            <input type="time" className="input-field" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Descripción / Notas</label>
                          <textarea className="input-field h-20" placeholder="Detalles adicionales..." value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className={`w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Save size={20} />
                        {isSaving ? 'Registrando...' : (editingEvent ? 'Actualizar' : 'Agendar Registro')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setShowForm(false); setEditingEvent(null); }}
                        className="w-full py-2 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {getDayEvents(selectedDate).map((event) => (
                      <div key={event.id} className={`p-4 rounded-xl border-2 transition-colors ${
                        event.notified 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-white border-slate-300'
                      } space-y-3`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              event.type === 'cumpleaños' ? 'bg-pink-100 text-pink-700' :
                              event.type === 'aniversario' ? 'bg-amber-100 text-amber-700' :
                              event.type === 'mto' ? 'bg-blue-100 text-blue-700' :
                              event.type === 'recordatorio' ? 'bg-indigo-100 text-indigo-700' :
                              'bg-project-100 text-project-700'
                            }`}>
                              {event.type}
                            </span>
                            {event.notified && (
                              <span className="ml-2 px-2 py-1 rounded-md bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                                Notificado
                              </span>
                            )}
                            <h4 className="text-lg font-black mt-1 text-project-900">{event.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-project-700 mt-1 font-black">
                              <Clock size={14} />
                              <span>{event.time} hs</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => shareOnWhatsApp(event)} className="p-2 text-green-500 hover:bg-green-50 rounded-lg">
                              <Share2 size={18} />
                            </button>
                            <button onClick={() => { setEditingEvent(event); setNewEvent(event); setShowForm(true); setShowModal(false); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDeleteEvent(event)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        {event.description && (
                          <p className="text-sm text-project-800 border-t border-sky-100 pt-2 font-bold">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={() => { setShowForm(true); setShowModal(false); }}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-project-500 hover:text-project-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={20} />
                      <span>Agregar otro evento</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgendaJefatura;
