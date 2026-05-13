import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, MessageSquare, 
  CheckCircle2, AlertCircle, Calendar, Send, 
  X, Clock, Save, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { sendMtoNotification } from '../services/telegram';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Mto = () => {
  const [mtos, setMtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMto, setEditingMto] = useState(null);
  const [newMto, setNewMto] = useState({
    type: 'recibido', 
    date: format(new Date(), 'yyyy-MM-dd'),
    content: '',
    prefix: '',
    number: '',
    completed: false,
    hasDeadline: false,
    deadlineDate: '',
    deadlineTime: '23:59'
  });

  const fetchMtos = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'mtos'));
      setMtos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching MTos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMtos();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (editingMto) {
        await updateDoc(doc(db, 'mtos', editingMto.id), newMto);
        await sendMtoNotification(newMto, true);
      } else {
        await addDoc(collection(db, 'mtos'), { ...newMto, notified: false });
        await sendMtoNotification(newMto, false);
      }
      setShowForm(false);
      setEditingMto(null);
      setNewMto({ type: 'recibido', date: format(new Date(), 'yyyy-MM-dd'), content: '', prefix: '', number: '', completed: false, hasDeadline: false, deadlineDate: '', deadlineTime: '23:59' });
      fetchMtos();
    } catch (error) {
      console.error("Error saving MTO:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleComplete = async (mto) => {
    await updateDoc(doc(db, 'mtos', mto.id), { completed: !mto.completed });
    fetchMtos();
  };

  const handleDeleteMto = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar MTO?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'mtos', id));
        fetchMtos();
        Swal.fire('Eliminado', 'El MTO ha sido eliminado.', 'success');
      } catch (error) {
        console.error("Error deleting:", error);
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  };

  const filteredMtos = mtos.filter(m => 
    m.content?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.number?.includes(searchTerm) ||
    m.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.date.includes(searchTerm)
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const exportToPDF = () => {
    const doc = new jsPDF();
    const cleanText = (str) => str ? str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '') : '';
    
    doc.setFontSize(18);
    doc.setTextColor(11, 51, 31);
    doc.text('REPORTE DE MENSAJES DE TRÁFICO (MTO)', 105, 15, { align: 'center' });
    
    const tableData = filteredMtos.map(m => [
      format(parseISO(m.date), 'dd/MM/yyyy'),
      `${m.prefix} ${m.number}`,
      m.type.toUpperCase(),
      cleanText(m.content),
      m.hasDeadline ? format(parseISO(m.deadlineDate), 'dd/MM/yyyy') : '-'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Fecha', 'MTO #', 'Tipo', 'Contenido', 'Plazo']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 51, 31] }
    });
    
    doc.save(`reporte_mto_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex-1 min-w-[300px] relative">
          <input 
            className="input-field"
            placeholder="Buscar MTO por contenido o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="p-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" title="Descargar Reporte">
            <FileText size={20} />
          </button>
          <button onClick={() => { setShowForm(true); setEditingMto(null); }} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            <span>Registrar MTO</span>
          </button>
        </div>
      </div>

      <div className="space-y-4 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && filteredMtos.map((mto) => {
          const isDeadlinePassed = mto.hasDeadline && !mto.completed && isPast(parseISO(mto.deadlineDate));
          
          return (
            <motion.div 
              layout
              key={mto.id}
              className={`project-card p-5 border-l-4 transition-colors ${
                mto.notified 
                  ? 'bg-green-50 border-l-green-500' 
                  : mto.type === 'enviado' ? 'border-l-blue-500' : 'border-l-project-600'
              } flex flex-col md:flex-row gap-6 items-start md:items-center`}
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                    mto.type === 'enviado' ? 'bg-blue-100 text-blue-700' : 'bg-project-100 text-project-700'
                  }`}>
                    MTO {mto.type}
                  </span>
                  <span className="text-xs font-black text-project-900 bg-slate-100 px-2 py-1 rounded">
                    MTO: {mto.prefix} {mto.number}
                  </span>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Calendar size={12} /> {format(parseISO(mto.date), "dd/MM/yyyy", { locale: es })}
                  </span>
                  {mto.notified && (
                    <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded flex items-center gap-1">
                      <Send size={10} /> NOTIFICADO
                    </span>
                  )}
                  {mto.hasDeadline && (
                    <span className={`text-xs font-bold flex items-center gap-1 ${isDeadlinePassed ? 'text-red-500' : 'text-amber-500'}`}>
                      <AlertCircle size={12} /> Plazo: {format(parseISO(mto.deadlineDate), "EEEE d 'de' MMMM", { locale: es })} {mto.deadlineTime} hs
                    </span>
                  )}
                </div>
                <p className="text-project-900 font-bold">
                  {mto.content}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                {mto.type === 'recibido' && (
                  <button 
                    onClick={() => toggleComplete(mto)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      mto.completed 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-bold">{mto.completed ? 'Cumplimentado' : 'Pendiente'}</span>
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingMto(mto); setNewMto(mto); setShowForm(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={20} />
                  </button>
                  <button onClick={() => handleDeleteMto(mto.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {!loading && filteredMtos.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-sky-200">
            <MessageSquare size={48} className="mx-auto text-sky-300 mb-4" />
            <p className="text-project-900 font-bold">No hay mensajes de tráfico oficial registrados</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="w-full max-w-xl project-card m-2 sm:m-4 max-h-[95vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-project-900">{editingMto ? 'Editar MTO' : 'Registrar MTO'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-900"><X size={24} /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tipo</label>
                    <div className="flex p-1 bg-sky-50 rounded-xl border border-sky-100">
                      <button 
                        type="button" 
                        onClick={() => setNewMto({...newMto, type: 'recibido'})}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${newMto.type === 'recibido' ? 'bg-white shadow-sm text-project-700' : 'text-slate-400'}`}
                      >
                        RECIBIDO
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setNewMto({...newMto, type: 'enviado'})}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${newMto.type === 'enviado' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-400'}`}
                      >
                        ENVIADO
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Fecha de MTO</label>
                    <input type="date" className="input-field" value={newMto.date} onChange={(e) => setNewMto({...newMto, date: e.target.value})} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Prefijo (Letra/Sigla)</label>
                    <input className="input-field uppercase" placeholder="Ej. A, B, C..." value={newMto.prefix} onChange={(e) => setNewMto({...newMto, prefix: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Número de MTO</label>
                    <input className="input-field" placeholder="0000" value={newMto.number} onChange={(e) => setNewMto({...newMto, number: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Contenido / Reseña</label>
                  <textarea 
                    className="input-field h-32 resize-none" 
                    placeholder="Escriba el contenido del mensaje de tráfico..." 
                    value={newMto.content} 
                    onChange={(e) => setNewMto({...newMto, content: e.target.value})} 
                    required 
                  />
                </div>

                <div className="space-y-3 p-4 bg-sky-50 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500" /> ¿Tiene plazo de cumplimiento?
                    </label>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-md border-slate-300 text-project-600 focus:ring-project-500" 
                      checked={newMto.hasDeadline}
                      onChange={(e) => setNewMto({...newMto, hasDeadline: e.target.checked})}
                    />
                  </div>
                  
                  {newMto.hasDeadline && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Fecha Límite</label>
                        <input type="date" className="input-field" value={newMto.deadlineDate} onChange={(e) => setNewMto({...newMto, deadlineDate: e.target.value})} required={newMto.hasDeadline} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Hora Límite</label>
                        <input type="time" className="input-field" value={newMto.deadlineTime} onChange={(e) => setNewMto({...newMto, deadlineTime: e.target.value})} />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="pt-2 space-y-2">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Send size={20} /> {isSaving ? 'Registrando...' : (editingMto ? 'Actualizar MTO' : 'Registrar MTO')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Mto;
