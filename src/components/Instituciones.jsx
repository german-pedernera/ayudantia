import { useState, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Edit2, Save, Share2, 
  FileText, Building, User, MapPin, Calendar, 
  X, Map as MapIcon, Clock, MessageCircle, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseISO, differenceInYears, format } from 'date-fns';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { sendInstitutionNotification } from '../services/telegram';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const Instituciones = () => {
  const [institutions, setInstitutions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [showMapModal, setShowMapModal] = useState(null);
  const [mapPosition, setMapPosition] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [viewingInst, setViewingInst] = useState(null);

  const initialFormState = {
    name: '',
    creationDate: '',
    inCharge: '',
    assistant: '',
    address: '',
    street: '',
    number: '',
    locality: '',
    province: 'Buenos Aires',
    instType: 'Escuadrón',
    phones: [''],
    notificationTime: '08:00'
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchInstitutions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'institutions'));
      setInstitutions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching institutions:", error);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const cleanText = (str) => str ? str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '') : '';
    
    doc.setFontSize(18);
    doc.setTextColor(11, 51, 31);
    doc.text('REPORTE DE INSTITUCIONES Y UNIDADES', 105, 15, { align: 'center' });
    
    const tableData = institutions.map(i => [
      cleanText(i.name),
      i.instType,
      i.locality,
      i.province,
      cleanText(i.inCharge) || '-'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Nombre', 'Tipo', 'Localidad', 'Provincia', 'Encargado']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [11, 51, 31] }
    });
    
    doc.save(`instituciones_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  const calculateYears = (date) => {
    if (!date) return 0;
    try {
      return differenceInYears(new Date(), parseISO(date));
    } catch {
      return 0;
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData };
      delete dataToSave.id;

      if (editingInst) {
        await updateDoc(doc(db, 'institutions', editingInst.id), dataToSave);
        await sendInstitutionNotification(dataToSave, true);
      } else {
        await addDoc(collection(db, 'institutions'), dataToSave);
        await sendInstitutionNotification(dataToSave, false);
      }

      setShowForm(false);
      setEditingInst(null);
      setFormData(initialFormState);
      await fetchInstitutions();
    } catch (error) {
      console.error("Error saving institution:", error);
      Swal.fire('Error', "Error al guardar: " + error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Desea eliminar esta institución?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'institutions', id));
        fetchInstitutions();
        Swal.fire('Eliminado', 'Institución eliminada.', 'success');
      } catch (error) {
        console.error("Error deleting:", error);
        Swal.fire('Error', 'No se pudo eliminar.', 'error');
      }
    }
  };

  const openEdit = (inst) => {
    setEditingInst(inst);
    setFormData({ ...initialFormState, ...inst });
    setShowForm(true);
  };

  const handlePhoneChange = (idx, value) => {
    const newPhones = [...formData.phones];
    newPhones[idx] = value;
    setFormData({ ...formData, phones: newPhones });
  };

  const addPhoneField = () => {
    setFormData({ ...formData, phones: [...formData.phones, ''] });
  };

  const geocodeAddress = async (inst) => {
    setIsGeocoding(true);
    setMapPosition(null);
    try {
      const fullAddr = inst.street 
        ? `${inst.street} ${inst.number}, ${inst.locality}, ${inst.province}, Argentina`
        : `${inst.address}, Argentina`;
      
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddr)}&limit=1`);
      
      if (response.data && response.data.length > 0) {
        setMapPosition([parseFloat(response.data[0].lat), parseFloat(response.data[0].lon)]);
      } else {
        const fallback = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${inst.locality}, ${inst.province}, Argentina`)}&limit=1`);
        if (fallback.data && fallback.data.length > 0) {
          setMapPosition([parseFloat(fallback.data[0].lat), parseFloat(fallback.data[0].lon)]);
        }
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const shareWhatsApp = (inst) => {
    const text = `🏛️ *INSTITUCIÓN:* ${inst.name}\n👤 *Encargado:* ${inst.inCharge}\n📍 *Dirección:* ${inst.street} ${inst.number}, ${inst.locality}\n📞 *Teléfonos:* ${inst.phones.join(', ')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const filteredInstitutions = institutions.filter(i => 
    i.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.inCharge?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.locality?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex-1 min-w-[300px] relative">
          <input 
            className="input-field"
            placeholder="Buscar por nombre, encargado o localidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="p-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors" title="Descargar Reporte">
            <Download size={20} />
          </button>
          <button 
            onClick={() => { setFormData(initialFormState); setEditingInst(null); setShowForm(true); }} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Nueva Institución</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 relative min-h-[400px]">
        {filteredInstitutions.map((inst) => (
          <motion.div layout key={inst.id} onClick={() => { setViewingInst(inst); geocodeAddress(inst); }} className="project-card p-6 flex flex-col justify-between group cursor-pointer hover:shadow-xl transition-all">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-project-600 text-white shadow-lg shadow-project-600/20">
                    <Building size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-project-900 text-lg leading-tight">{inst.name}</h4>
                    <p className="text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Calendar size={12} /> Fundada hace {calculateYears(inst.creationDate)} años
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(inst); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(inst.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <div className="flex items-center gap-2 text-sm text-project-900 font-black">
                  <User size={16} className="text-project-700" />
                  <span><b>Jefe:</b> {inst.inCharge}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-project-900 font-black">
                  <MapPin size={16} className="text-project-700" />
                  <span>{inst.street} {inst.number}, {inst.locality}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {inst.phones.map((p, idx) => p && (
                    <span key={idx} className="px-2 py-1 bg-sky-50 border border-sky-100 rounded-md text-[11px] font-black text-project-900">
                      📞 {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              {/* Note: The dedicated Map button is kept for backwards compatibility but isn't strictly necessary anymore */}
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMapModal(inst); geocodeAddress(inst); }}
                className="flex-1 py-2.5 bg-sky-50 hover:bg-sky-100 rounded-xl border border-sky-200 flex items-center justify-center gap-2 text-xs font-black text-project-900 transition-all"
              >
                <MapIcon size={16} /> Mapa
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); shareWhatsApp(inst); }}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md"
              >
                <Share2 size={16} /> WhatsApp
              </button>
            </div>
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
                <h3 className="text-xl font-black text-project-900">{editingInst ? 'Editar Institución' : 'Nueva Institución'}</h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full text-project-900"><X size={24} /></button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Institución</label>
                    <input className="input-field" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Fecha de Creación</label>
                    <input type="date" className="input-field" value={formData.creationDate} onChange={(e) => setFormData({...formData, creationDate: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Jefe / A Cargo</label>
                    <input className="input-field" value={formData.inCharge} onChange={(e) => setFormData({...formData, inCharge: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Secretario / Ayudante</label>
                    <input className="input-field" value={formData.assistant} onChange={(e) => setFormData({...formData, assistant: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Calle / Avenida</label>
                    <input className="input-field" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Número</label>
                    <input className="input-field" value={formData.number} onChange={(e) => setFormData({...formData, number: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Localidad</label>
                    <input className="input-field" value={formData.locality} onChange={(e) => setFormData({...formData, locality: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Provincia</label>
                    <input className="input-field" value={formData.province} onChange={(e) => setFormData({...formData, province: e.target.value})} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500">Tipo de Unidad</label>
                    <select className="input-field" value={formData.instType} onChange={(e) => setFormData({...formData, instType: e.target.value})}>
                      <option value="Escuadrón">Escuadrón</option>
                      <option value="Sección">Sección</option>
                      <option value="Grupo">Grupo</option>
                      <option value="Puesto">Puesto</option>
                      <option value="Destacamento">Destacamento</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-black text-slate-500">Horario de Aviso (Telegram)</label>
                    <input type="time" className="input-field" value={formData.notificationTime} onChange={(e) => setFormData({...formData, notificationTime: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-500 flex justify-between">
                    Teléfonos
                    <button type="button" onClick={addPhoneField} className="text-project-700 text-xs hover:underline font-black">+ Añadir otro</button>
                  </label>
                  {formData.phones.map((phone, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input className="input-field" value={phone} onChange={(e) => handlePhoneChange(idx, e.target.value)} placeholder="Ej. +54 9..." />
                      {idx > 0 && (
                        <button type="button" onClick={() => setFormData({...formData, phones: formData.phones.filter((_, i) => i !== idx)})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl">
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg"
                  >
                    <Save size={24} />
                    {isSaving ? 'Guardando...' : (editingInst ? 'Actualizar Institución' : 'Guardar Institución')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-300">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-xl font-black text-project-900">{showMapModal.name}</h3>
                  <p className="text-sm text-slate-500 font-bold">{showMapModal.street} {showMapModal.number}, {showMapModal.locality}</p>
                </div>
                <button onClick={() => setShowMapModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-project-900"><X size={24} /></button>
              </div>
              <div className="h-[500px] bg-slate-100 relative">
                 {mapPosition ? (
                   <MapContainer center={mapPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                     <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                     <Marker position={mapPosition}>
                       <ChangeView center={mapPosition} />
                     </Marker>
                   </MapContainer>
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                     {isGeocoding ? (
                       <div className="w-12 h-12 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
                     ) : (
                       <p className="text-slate-500 font-bold">No se pudo localizar la dirección exacta en el mapa.</p>
                     )}
                   </div>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingInst && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setViewingInst(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-project-600/20"
            >
              <div className="p-6 border-b border-sky-100 flex justify-between items-start bg-project-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Building size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-project-600 rounded-2xl text-white shadow-lg">
                      <Building size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-project-900 tracking-tight">{viewingInst.name}</h3>
                      <p className="text-project-700 font-bold flex items-center gap-1 text-sm">
                        <Calendar size={14} /> Fundada hace {calculateYears(viewingInst.creationDate)} años ({viewingInst.creationDate})
                      </p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewingInst(null)} className="p-2 hover:bg-project-200/50 rounded-xl transition-colors relative z-10 text-project-900">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Jefe / A Cargo</p>
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <User size={16} className="text-project-600" />
                      {viewingInst.inCharge}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Secretario / Ayudante</p>
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <User size={16} className="text-slate-400" />
                      {viewingInst.assistant || 'No asignado'}
                    </p>
                  </div>
                </div>

                <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100">
                  <p className="text-[10px] text-sky-600 font-black uppercase tracking-widest mb-2">Ubicación</p>
                  <div className="space-y-4">
                    <div>
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        <MapPin size={16} className="text-sky-600" />
                        {viewingInst.street} {viewingInst.number}
                      </p>
                      <p className="text-sm font-bold text-slate-600 ml-6">
                        {viewingInst.locality}, {viewingInst.province}
                      </p>
                    </div>
                    
                    {/* Map Box */}
                    <div className="h-[250px] w-full rounded-xl overflow-hidden border border-sky-200 relative bg-slate-100">
                      {mapPosition ? (
                        <MapContainer center={mapPosition} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={mapPosition}>
                            <ChangeView center={mapPosition} />
                          </Marker>
                        </MapContainer>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                          {isGeocoding ? (
                            <div className="w-8 h-8 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <p className="text-slate-500 font-bold text-xs">Ubicación no encontrada.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                  <p className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-3">Contacto</p>
                  <div className="flex flex-wrap gap-2">
                    {viewingInst.phones.filter(Boolean).map((phone, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-white border border-green-200 rounded-lg text-sm font-black text-green-700 flex items-center gap-2">
                        📞 {phone}
                      </span>
                    ))}
                    {viewingInst.phones.filter(Boolean).length === 0 && (
                      <span className="text-sm text-slate-500 font-bold">Sin teléfonos registrados</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => { setViewingInst(null); shareWhatsApp(viewingInst); }}
                  className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-lg flex items-center gap-2"
                >
                  <MessageCircle size={18} /> Compartir
                </button>
                <button 
                  onClick={() => setViewingInst(null)}
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

export default Instituciones;
