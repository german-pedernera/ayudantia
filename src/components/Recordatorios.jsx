import { useState, useEffect } from 'react';
import { 
  Clock, Download, X, Search,
  Plus, Edit2, Trash2, Save, Bell, Share2, 
  CheckCircle2, Calendar, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { 
  collection, addDoc, deleteDoc, doc, 
  updateDoc, query, orderBy, onSnapshot 
} from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendReminderNotification } from '../services/telegram';
import Swal from 'sweetalert2';

const Recordatorios = () => {
  // --- States ---
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewingReminder, setViewingReminder] = useState(null);
  
  const initialFormState = {
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    notified: false
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- Firebase Interactions ---
  useEffect(() => {
    const q = query(collection(db, 'reminders'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReminders(data);
      setLoading(false);
    }, (error) => {
      console.error("Firebase error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const cleanText = (str) => str ? str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '') : '';
    
    doc.setFontSize(18);
    doc.setTextColor(11, 51, 31);
    doc.text('REPORTE DE RECORDATORIOS', 105, 15, { align: 'center' });
    
    const tableData = reminders.map(r => [
      format(parseISO(r.date), 'dd/MM/yyyy'),
      r.time,
      cleanText(r.title),
      r.completed ? 'COMPLETADO' : 'PENDIENTE'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Fecha', 'Hora', 'Descripción', 'Estado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 51, 31] }
    });
    
    doc.save(`recordatorios_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        content: formData.title, // Sync content with title for legacy support
        priority: 'media' // Default priority
      };

      if (editingId) {
        await updateDoc(doc(db, 'reminders', editingId), dataToSave);
        await sendReminderNotification(dataToSave, true);
      } else {
        await addDoc(collection(db, 'reminders'), { ...dataToSave, notified: false });
        await sendReminderNotification(dataToSave, false);
      }
      closeForm();
    } catch (error) {
      console.error("Error saving reminder:", error);
      Swal.fire('Error', "Error al guardar el recordatorio.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Desea eliminar este recordatorio?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'reminders', id));
        Swal.fire('Eliminado', 'Recordatorio eliminado.', 'success');
      } catch (error) {
        console.error("Error deleting:", error);
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  };

  // --- UI Helpers ---
  const openForm = (reminder = null) => {
    if (reminder) {
      setFormData({
        title: reminder.title,
        date: reminder.date,
        time: reminder.time,
        notified: reminder.notified || false
      });
      setEditingId(reminder.id);
    } else {
      setFormData(initialFormState);
      setEditingId(null);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const downloadPDF = (reminder) => {
    const doc = new jsPDF();
    
    // Function to clean emojis and special characters for PDF
    const cleanString = (str) => {
      if (!str) return '';
      return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
                .replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, ''); // Keep common Spanish chars, remove others
    };

    doc.setFillColor(11, 51, 31);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('RECORDATORIO - GNA', 20, 25);
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    const dateFormatted = format(parseISO(reminder.date), "EEEE d 'de' MMMM", { locale: es });
    doc.text(`Fecha Programada: ${dateFormatted} a las ${reminder.time} hs`, 20, 50);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    
    const titleText = cleanString(reminder.title);
    const splitTitle = doc.splitTextToSize(titleText, 170);
    
    doc.text('Asunto / Detalle:', 20, 65);
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(splitTitle, 20, 75);
    
    const safeTitle = cleanString(reminder.title).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`recordatorio_${safeTitle}.pdf`);
  };

  const handleShareWhatsApp = (rem) => {
    const text = `🔔 *RECORDATORIO - GNA*\n\n📌 *Tema:* ${rem.title}\n📅 *Fecha:* ${format(parseISO(rem.date), "EEEE d 'de' MMMM", { locale: es })}\n🕒 *Hora:* ${rem.time} hs\n\n_Enviado desde Sistema Ayudantía_`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareWhatsApp = (reminder) => {
    const text = `📌 *RECORDATORIO GNA*\n\n*Tema:* ${reminder.title}\n*Fecha:* ${reminder.date}\n*Hora:* ${reminder.time} hs`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const filteredReminders = reminders.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.date.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[300px] relative">
          <input 
            className="input-field"
            placeholder="Buscar por tema o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => openForm()}
          className="btn-primary flex items-center gap-2 py-3 px-6 shadow-lg shadow-project-600/20 active:scale-95 transition-all"
        >
          <Plus size={20} />
          <span className="font-bold">Nuevo Recordatorio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredReminders.map((rem) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={rem.id}
              onClick={() => setViewingReminder(rem)}
              className={`project-card p-6 flex flex-col h-full border-t-4 transition-all cursor-pointer hover:shadow-xl ${
                rem.notified 
                  ? 'bg-green-50 border-t-green-500' 
                  : 'border-t-project-600'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-project-900 font-black">
                    <Calendar size={14} className="text-project-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {format(parseISO(rem.date), "EEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-project-900 font-black">
                    <Clock size={14} className="text-amber-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {rem.time} hs
                    </span>
                  </div>
                </div>
                {rem.notified && (
                  <div className="flex flex-col items-end gap-1">
                    <CheckCircle2 size={20} className="text-green-500" />
                    <span className="text-[8px] font-black text-green-600 uppercase tracking-tighter">Notificado</span>
                  </div>
                )}
              </div>

              <h3 className="text-xl font-black text-project-900 line-clamp-2 mb-6 min-h-[3.5rem]">
                {rem.title}
              </h3>

              <div className="flex items-center justify-between pt-4 border-t border-sky-100">
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); downloadPDF(rem); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                    <Download size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); shareWhatsApp(rem); }} className="p-2 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all">
                    <Share2 size={18} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openForm(rem); }} className="p-2 text-slate-400 hover:text-project-600 hover:bg-project-50 rounded-lg transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(rem.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredReminders.length === 0 && !loading && (
        <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-300">
          <Bell size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900">Sin Recordatorios</h3>
          <p className="text-slate-600 mt-2 font-bold">No hay notas registradas.</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl project-card overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-project-600 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Bell size={20} /> {editingId ? 'Editar Aviso' : 'Nuevo Aviso Programado'}
                </h3>
                <button onClick={closeForm} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-project-700">Tema a recordar</label>
                  <textarea 
                    className="input-field text-lg min-h-[120px] resize-none"
                    placeholder="Ej. Realizar relevamiento de puestos..."
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-project-700">Fecha</label>
                    <input 
                      type="date"
                      className="input-field"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-project-700">Hora</label>
                    <input 
                      type="time"
                      className="input-field"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeForm}
                    className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 text-lg shadow-xl shadow-project-600/20 active:scale-95 transition-all"
                  >
                    {isSaving ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Save size={20} />
                        <span>{editingId ? 'Actualizar' : 'Guardar Aviso'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading && !showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/10 backdrop-blur-[1px]">
          <div className="w-10 h-10 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <AnimatePresence>
        {viewingReminder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setViewingReminder(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-sky-100 flex justify-between items-center bg-project-600 text-white">
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Bell size={24} /> Detalle del Recordatorio
                </h3>
                <button 
                  onClick={() => setViewingReminder(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sky-50 p-4 rounded-2xl">
                  <div className="flex items-center gap-3 text-project-900 font-black">
                    <div className="w-10 h-10 rounded-full bg-project-100 flex items-center justify-center text-project-600">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-project-600 uppercase tracking-widest font-black">Programado para</p>
                      <p className="text-lg">{format(parseISO(viewingReminder.date), "EEEE d 'de' MMMM", { locale: es })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-project-900 font-black">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-600 uppercase tracking-widest font-black">Horario</p>
                      <p className="text-lg">{viewingReminder.time} hs</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Tema / Contenido</h4>
                  <p className="text-xl font-bold text-slate-800 leading-relaxed bg-white p-4 rounded-2xl border border-slate-100">
                    {viewingReminder.title}
                  </p>
                </div>
                
                {viewingReminder.notified && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 p-4 rounded-2xl font-bold">
                    <CheckCircle2 size={24} />
                    Este recordatorio ya fue notificado por Telegram.
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-4">
                <button 
                  onClick={() => handleShareWhatsApp(viewingReminder)}
                  className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all flex items-center gap-2 shadow-lg shadow-green-200"
                >
                  <MessageCircle size={20} /> Compartir
                </button>
                <button 
                  onClick={() => setViewingReminder(null)}
                  className="px-6 py-3 bg-white text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Recordatorios;
