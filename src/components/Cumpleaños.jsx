import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, Save, Share2, 
  Cake, User, Phone, BadgeInfo, Clock, X, FileText, MessageCircle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { sendPersonnelNotification } from '../services/telegram';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';

const hierarchies = [
  'Comandante General', 'Comandante Mayor', 'Comandante Principal', 'Comandante', 'Segundo Comandante', 'Primer Alférez', 'Alférez', 'Subalférez',
  'Suboficial Mayor', 'Suboficial Principal', 'Sargento Ayudante', 'Sargento Primero', 'Sargento', 'Cabo Primero', 'Cabo', 'Gendarme', 'Gendarme II'
];

const Cumpleaños = () => {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [viewingPerson, setViewingPerson] = useState(null);
  const [newPerson, setNewPerson] = useState({
    hierarchy: '',
    name: '',
    birthDate: '',
    mi: '',
    ce: '',
    phone: '',
    civilStatus: 'soltero',
    notificationTime: '08:00'
  });

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'personnel'));
      setPersonnel(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching personnel:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const cleanText = (str) => str ? str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '') : '';
    
    doc.setFontSize(18);
    doc.setTextColor(11, 51, 31);
    doc.text('REPORTE DE PERSONAL Y CUMPLEAÑOS', 105, 15, { align: 'center' });
    
    const tableData = personnel.map(p => [
      p.hierarchy,
      cleanText(p.name),
      format(parseISO(p.birthDate), 'dd/MM/yyyy'),
      calculateAge(p.birthDate).toString(),
      p.phone || '-'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Jerarquía', 'Nombre', 'Nacimiento', 'Edad', 'Teléfono']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 51, 31] }
    });
    
    doc.save(`cumpleaños_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 0;
    try {
      const date = parseISO(birthDate);
      if (isNaN(date.getTime())) return 0;
      return differenceInYears(new Date(), date);
    } catch {
      return 0;
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (editingPerson) {
        await updateDoc(doc(db, 'personnel', editingPerson.id), newPerson);
        await sendPersonnelNotification(newPerson, true);
      } else {
        await addDoc(collection(db, 'personnel'), { ...newPerson, lastNotifiedDate: '' });
        await sendPersonnelNotification(newPerson, false);
      }
      setShowForm(false);
      setEditingPerson(null);
      setNewPerson({ hierarchy: '', name: '', birthDate: '', mi: '', ce: '', phone: '', civilStatus: 'soltero', notificationTime: '08:00' });
      fetchPersonnel();
    } catch (error) {
      console.error("Error saving personnel:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar registro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'personnel', id));
        fetchPersonnel();
        Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');
      } catch (error) {
        console.error("Error deleting:", error);
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  };

  const shareWhatsApp = (person) => {
    const text = `Cumpleaños: ${person.hierarchy} ${person.name} - Fecha: ${person.birthDate} (${calculateAge(person.birthDate)} años)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      
      const cleanText = (str) => {
        if (!str) return '';
        return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
                  .replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '');
      };

      doc.text('Listado de Cumpleaños - Personal', 20, 10);
      const tableData = filteredPersonnel.map(p => [
        cleanText(p.hierarchy) || '-',
        cleanText(p.name) || '-',
        p.mi || '-',
        p.ce || '-',
        p.birthDate ? format(parseISO(p.birthDate), "dd/MM/yyyy") : '-',
        calculateAge(p.birthDate).toString(),
        p.phone || '-'
      ]);
      
      autoTable(doc, {
        head: [['Jerarquía', 'Nombre y apellido', 'MI', 'CE', 'Fecha Nac.', 'Edad', 'Teléfono']],
        body: tableData,
        startY: 20,
        headStyles: { fillColor: [11, 51, 31] }
      });
      doc.save('cumpleaños.pdf');
    } catch (error) {
      console.error("Error al generar PDF:", error);
      Swal.fire('Error', "Hubo un error al generar el PDF. Verifica los datos.", 'error');
    }
  };

  const filteredPersonnel = personnel.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.mi?.includes(searchTerm) || 
    p.hierarchy?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex-1 min-w-[300px] relative">
          <input 
            className="input-field"
            placeholder="Buscador en vivo (Nombre, MI, Jerarquía)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="p-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" title="Descargar Reporte">
            <Download size={20} />
          </button>
          <button onClick={() => { setShowForm(true); setEditingPerson(null); }} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            <span>Nuevo Personal</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {!loading && filteredPersonnel.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-300">
            <Cake size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-bold">No se encontraron registros de personal</p>
          </div>
        )}

        {!loading && filteredPersonnel.map((person) => (
          <motion.div 
            layout
            key={person.id}
            onClick={() => setViewingPerson(person)}
            className="project-card p-6 space-y-4 hover:shadow-2xl transition-shadow cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-project-600 text-white shadow-lg shadow-project-600/20">
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg leading-tight">{person.name}</h4>
                  <p className="text-sm text-project-700 font-black">{person.hierarchy}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setEditingPerson(person); setNewPerson(person); setShowForm(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md">
                  <Edit2 size={16} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 border-t border-sky-100 pt-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <Cake size={10} /> Nacimiento / Edad
                </p>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-project-900">
                    {person.birthDate ? format(parseISO(person.birthDate), "d 'de' MMMM 'de' yyyy", { locale: es }) : '---'}
                  </span>
                  <span className="text-sm text-project-700 font-bold">
                    ({calculateAge(person.birthDate)} años)
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <BadgeInfo size={10} /> MI (DNI)
                </p>
                <p className="text-sm font-black text-project-900">{person.mi}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <BadgeInfo size={10} /> Código Estadístico
                </p>
                <p className="text-sm font-black text-project-900">{person.ce || 'No asignado'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <Phone size={10} /> Teléfono Particular
                </p>
                <p className="text-sm font-black text-project-900">{person.phone || 'No registrado'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <User size={10} /> Estado Civil
                </p>
                <p className="text-sm font-black text-project-900 capitalize">{person.civilStatus}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-project-700 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} /> Aviso Telegram
                </p>
                <p className="text-sm font-black text-project-800">{person.notificationTime || '08:00'} hs</p>
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); shareWhatsApp(person); }}
              className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <Share2 size={16} /> Enviar por WhatsApp
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="w-full max-w-2xl project-card m-2 sm:m-4 max-h-[95vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingPerson ? 'Editar Personal' : 'Registrar Nuevo Personal'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Jerarquía</label>
                  <select 
                    className="input-field"
                    value={newPerson.hierarchy}
                    onChange={(e) => setNewPerson({...newPerson, hierarchy: e.target.value})}
                    required
                  >
                    <option value="">Seleccione...</option>
                    {hierarchies.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nombre y Apellido</label>
                  <input 
                    className="input-field"
                    placeholder="Ej. Juan Perez"
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({...newPerson, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fecha de Nacimiento</label>
                  <input 
                    type="date"
                    className="input-field"
                    value={newPerson.birthDate}
                    onChange={(e) => setNewPerson({...newPerson, birthDate: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">MI (DNI)</label>
                  <input 
                    className="input-field"
                    value={newPerson.mi}
                    onChange={(e) => setNewPerson({...newPerson, mi: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">CE (Código Estadístico)</label>
                  <input 
                    className="input-field"
                    value={newPerson.ce}
                    onChange={(e) => setNewPerson({...newPerson, ce: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Teléfono Particular</label>
                  <input 
                    className="input-field"
                    placeholder="Ej. +54 9 11..."
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({...newPerson, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Estado Civil</label>
                  <select 
                    className="input-field"
                    value={newPerson.civilStatus}
                    onChange={(e) => setNewPerson({...newPerson, civilStatus: e.target.value})}
                  >
                    <option value="soltero">Soltero/a</option>
                    <option value="casado">Casado/a</option>
                    <option value="union convivencial">Unión Convivencial</option>
                    <option value="viudo">Viudo/a</option>
                    <option value="divorciado">Divorciado/a</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Horario de Aviso (Telegram)</label>
                  <input 
                    type="time"
                    className="input-field"
                    value={newPerson.notificationTime}
                    onChange={(e) => setNewPerson({...newPerson, notificationTime: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2 pt-4 space-y-2">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`w-full btn-primary py-3 flex items-center justify-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Save size={20} /> {isSaving ? 'Guardando...' : (editingPerson ? 'Actualizar' : 'Guardar Registro')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="w-full py-2 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingPerson && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setViewingPerson(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-project-600/20"
            >
              <div className="p-6 border-b border-sky-100 flex justify-between items-start bg-project-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <User size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-project-600 rounded-2xl text-white shadow-lg">
                      <User size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-project-900 tracking-tight">{viewingPerson.name}</h3>
                      <p className="text-project-700 font-bold flex items-center gap-1 text-sm uppercase tracking-widest">
                        {viewingPerson.hierarchy}
                      </p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingPerson(null)} className="p-2 hover:bg-project-200/50 rounded-xl transition-colors relative z-10 text-project-900">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sky-50 p-4 rounded-2xl">
                  <div className="flex items-center gap-3 text-project-900 font-black">
                    <div className="w-10 h-10 rounded-full bg-project-100 flex items-center justify-center text-project-600">
                      <Cake size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-project-600 uppercase tracking-widest font-black">Nacimiento / Edad</p>
                      <p className="text-lg">
                        {viewingPerson.birthDate ? format(parseISO(viewingPerson.birthDate), "d 'de' MMMM 'de' yyyy", { locale: es }) : 'No registrado'}
                        {viewingPerson.birthDate && <span className="text-project-700 ml-1">({calculateAge(viewingPerson.birthDate)} años)</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><BadgeInfo size={12} /> MI (DNI)</p>
                    <p className="font-bold text-slate-800 text-lg">
                      {viewingPerson.mi || '---'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><BadgeInfo size={12} /> Código Estadístico</p>
                    <p className="font-bold text-slate-800 text-lg">
                      {viewingPerson.ce || 'No asignado'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Phone size={12} /> Teléfono Particular</p>
                    <p className="font-bold text-slate-800 text-lg">
                      {viewingPerson.phone || 'No registrado'}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><User size={12} /> Estado Civil</p>
                    <p className="font-bold text-slate-800 text-lg capitalize">
                      {viewingPerson.civilStatus}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={12} /> Aviso Telegram</p>
                  <p className="font-bold text-slate-800 text-lg">
                    {viewingPerson.notificationTime || '08:00'} hs
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => { setViewingPerson(null); shareWhatsApp(viewingPerson); }}
                  className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-lg flex items-center gap-2"
                >
                  <Share2 size={18} /> Compartir
                </button>
                <button 
                  onClick={() => setViewingPerson(null)}
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

export default Cumpleaños;
