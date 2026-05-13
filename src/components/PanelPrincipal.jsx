import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, AlertCircle, 
  Bell, Trash2, CheckCircle2,
  Cloud, Thermometer, Wind, Droplets, Search, X, MapPin, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { 
  format, parseISO, isAfter, isBefore, startOfDay, addHours,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import Swal from 'sweetalert2';



const CardCalendar = ({ activities, onDayClick }) => {
  const today = new Date();
  const start = startOfMonth(today);
  const end = endOfMonth(today);
  const days = eachDayOfInterval({ start, end });
  const firstDayIndex = getDay(start);
  const padding = Array(firstDayIndex).fill(null);

  const getDayActivities = (date) => {
    return activities.filter(act => isSameDay(parseISO(act.date), date));
  };

  return (
    <div className="w-full select-none flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
           <Calendar size={20} className="text-project-600" />
           <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
             {format(today, 'MMMM yyyy', { locale: es })}
           </h4>
        </div>
        <span className="text-[10px] font-black bg-project-50 text-project-600 px-3 py-1 rounded-full border border-project-100 uppercase tracking-widest">
          Agenda
        </span>
      </div>
      <div className="grid grid-cols-7 gap-2 text-[10px] text-center text-slate-400 mb-4 font-bold uppercase tracking-widest">
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {padding.map((_, i) => <div key={`p-${i}`} className="h-10" />)}
        {days.map(day => {
          const dayActs = getDayActivities(day);
          const hasAct = dayActs.length > 0;
          
          return (
            <button 
              key={day.toString()}
              onClick={() => onDayClick(day, dayActs)}
              className={`h-12 w-full flex flex-col items-center justify-center rounded-xl text-sm font-bold transition-all relative group
                ${isToday(day) ? 'bg-project-600 text-white shadow-lg shadow-project-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}
                ${hasAct && !isToday(day) ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
              `}
            >
              <span className={isToday(day) ? 'scale-110' : ''}>{format(day, 'd')}</span>
              {hasAct && (
                <div className="flex gap-0.5 mt-1">
                  {dayActs.slice(0, 3).map((_, idx) => (
                    <div key={idx} className={`w-1 h-1 rounded-full ${isToday(day) ? 'bg-white/60' : 'bg-amber-400'}`}></div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PanelPrincipal = () => {
  const [activities, setActivities] = useState([]);
  const [institutionsCount, setInstitutionsCount] = useState(0);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayActivities, setSelectedDayActivities] = useState([]);

  const handleDayClick = (day, dayActs) => {
    setSelectedDay(day);
    setSelectedDayActivities(dayActs);
  };
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [weatherCity, setWeatherCity] = useState('Santa Catalina, Arg.');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [worldSearchQuery, setWorldSearchQuery] = useState('');
  const [worldSearchResults, setWorldSearchResults] = useState([]);
  const [isSearchingTime, setIsSearchingTime] = useState(false);
  const [selectedWorldTime, setSelectedWorldTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = async (lat = -34.4072, lon = -58.9135, cityName = 'Santa Catalina, Arg.') => {
    try {
      setWeatherCity(cityName);
      setSearchResults([]); // Clear search after selection
      setSearchQuery('');
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
      const data = await response.json();
      setWeather(data.current);
      
      const daily = data.daily;
      const forecastData = daily.time.slice(0, 5).map((date, i) => ({
        date,
        max: daily.temperature_2m_max[i],
        min: daily.temperature_2m_min[i],
        code: daily.weather_code[i]
      }));
      setForecast(forecastData);
    } catch (error) {
      console.error("Error fetching weather:", error);
    }
  };

  const fetchAllActivities = async () => {
    setLoading(true);
    try {
      const todayYear = new Date().getFullYear();
      
      // 1. Fetch Agenda Jefatura
      const agendaSnap = await getDocs(collection(db, 'events'));
      const agendaData = agendaSnap.docs.map(doc => ({
        id: doc.id,
        type: 'event',
        date: doc.data().date,
        time: doc.data().time || '08:00',
        title: `Agenda Jefatura: ${doc.data().title}`,
        description: doc.data().description || '',
        category: doc.data().type || 'reunion',
        completed: false
      }));

      // 2. Fetch Birthdays (Personnel)
      const personnelSnap = await getDocs(collection(db, 'personnel'));
      const birthdaysData = personnelSnap.docs.map(doc => {
        const birthDate = doc.data().birthDate;
        if (!birthDate || !birthDate.includes('-')) return null;
        const [, month, day] = birthDate.split('-');
        return {
          id: doc.id,
          type: 'birthday',
          date: `${todayYear}-${month}-${day}`,
          time: '00:00',
          title: `Cumpleaños: ${doc.data().hierarchy} ${doc.data().name}`,
          description: `Aniversario de natalicio`,
          category: 'natalicio'
        };
      }).filter(Boolean);

      // 3. Fetch MTos with deadlines
      const mtosSnap = await getDocs(collection(db, 'mtos'));
      const mtosData = mtosSnap.docs
        .filter(doc => doc.data().hasDeadline && doc.data().deadlineDate)
        .map(doc => ({
          id: doc.id,
          type: 'mto',
          date: doc.data().deadlineDate,
          time: doc.data().deadlineTime || '23:59',
          title: `Vencimiento MTO: ${doc.data().prefix || ''} ${doc.data().number || ''}`,
          description: doc.data().content,
          category: 'plazo',
          completed: doc.data().completed || false
        }));

      // 4. Fetch Reminders
      const remindersSnap = await getDocs(collection(db, 'reminders'));
      const remindersData = remindersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reminder',
          date: data.date,
          time: data.time,
          title: `Recordatorio: ${data.title}`,
          description: data.content?.replace(/<[^>]*>/g, '').substring(0, 80) || '',
          category: 'recordatorio',
          completed: data.notified || false
        };
      });

      // 5. Fetch Institutional Anniversaries
      const instSnap = await getDocs(collection(db, 'institutions'));
      setInstitutionsCount(instSnap.size);
      const anniversariesData = instSnap.docs.map(doc => {
        const creationDate = doc.data().creationDate;
        if (!creationDate || !creationDate.includes('-')) return null;
        const [year, month, day] = creationDate.split('-');
        return {
          id: doc.id,
          type: 'anniversary',
          date: `${todayYear}-${month}-${day}`,
          time: '00:00',
          title: `Aniversario: ${doc.data().name}`,
          description: `Fundada en el año ${year}`,
          category: 'aniversario'
        };
      }).filter(Boolean);

      // Combine and filter: only next 7 days from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 7);

      const allActivities = [
        ...agendaData, 
        ...birthdaysData, 
        ...mtosData, 
        ...remindersData, 
        ...anniversariesData
      ].filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date + 'T00:00:00');
        return d >= today && d < limit;
      }).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });

      setActivities(allActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchAllActivities();
      await fetchWeather();
    };
    init();
    
    // Real-time listeners for all relevant collections
    const unsubEvents = onSnapshot(collection(db, 'events'), fetchAllActivities);
    const unsubPersonnel = onSnapshot(collection(db, 'personnel'), fetchAllActivities);
    const unsubMtos = onSnapshot(collection(db, 'mtos'), fetchAllActivities);
    const unsubReminders = onSnapshot(collection(db, 'reminders'), fetchAllActivities);
    const unsubInstitutions = onSnapshot(collection(db, 'institutions'), fetchAllActivities);

    return () => {
      unsubEvents();
      unsubPersonnel();
      unsubMtos();
      unsubReminders();
      unsubInstitutions();
    };
  }, []);

  // Live Geocoding Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchQuery}&count=5&language=es&format=json`);
          const data = await res.json();
          setSearchResults(data.results || []);
        } catch (error) {
          console.error("Geocoding error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);
  
  // World Time Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (worldSearchQuery.length > 2) {
        setIsSearchingTime(true);
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${worldSearchQuery}&count=5&language=es&format=json`);
          const data = await res.json();
          setWorldSearchResults(data.results || []);
        } catch (error) {
          console.error("Geocoding error:", error);
        } finally {
          setIsSearchingTime(false);
        }
      } else {
        setWorldSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [worldSearchQuery]);

  const getWorldTime = (timezone) => {
    try {
      return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        hour12: false
      }).format(new Date());
    } catch {
      return "--:--:--";
    }
  };

  const shareWeatherWhatsApp = () => {
    if (!weather) return;
    const text = `🌦️ *REPORTE DEL CLIMA - GNA*\n📍 Ciudad: ${weatherCity}\n🌡️ Temperatura: ${weather.temperature_2m}°C\n💧 Humedad: ${weather.relative_humidity_2m}%\n💨 Viento: ${weather.wind_speed_10m} km/h`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareWorldTimeWhatsApp = () => {
    if (!selectedWorldTime) return;
    const time = getWorldTime(selectedWorldTime.timezone);
    const text = `🕒 *RELOJ MUNDIAL - GNA*\n📍 Ciudad: ${selectedWorldTime.name}, ${selectedWorldTime.country}\n⏰ Hora Local: ${time}\n🌎 Huso Horario: ${selectedWorldTime.timezone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getCategoryColor = (type, category, completed) => {
    if (completed) return 'bg-slate-400';
    if (type === 'birthday') return 'bg-pink-500';
    if (type === 'mto') return 'bg-red-500';
    
    if (!category) return 'bg-project-600';
    const cat = category.toLowerCase();
    if (cat.includes('reunion')) return 'bg-blue-500';
    if (cat.includes('desayuno')) return 'bg-cyan-500';
    if (cat.includes('almuerzo')) return 'bg-indigo-500';
    if (cat.includes('cena')) return 'bg-purple-500';
    if (cat.includes('natalicio')) return 'bg-pink-500';
    if (cat.includes('aniversario')) return 'bg-amber-500';
    if (cat.includes('plazo')) return 'bg-red-500';
    if (cat.includes('recordatorio')) return 'bg-emerald-500';
    return 'bg-project-600';
  };


  const handleToggleComplete = async (activity) => {
    if (activity.type === 'birthday') return; // Birthdays cannot be "completed"
    if (isSaving) return;
    setIsSaving(true);
    try {
      let collectionName = null;
      let updateField = 'completed';
      
      if (activity.type === 'event') collectionName = 'events';
      else if (activity.type === 'mto') collectionName = 'mtos';
      else if (activity.type === 'reminder') {
        collectionName = 'reminders';
        updateField = 'notified'; // In reminders we use 'notified'
      }

      if (collectionName) {
        await updateDoc(doc(db, collectionName, activity.id), { [updateField]: !activity.completed });
        fetchAllActivities();
      }
    } catch (error) {
      console.error("Error toggling complete:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (activity) => {
    if (activity.type === 'birthday') {
      Swal.fire('Atención', "Para eliminar un natalicio debe hacerlo desde la sección 'Cumpleaños Personal' eliminando al legajo correspondiente.", 'info');
      return;
    }

    if (isSaving) return;
    
    const result = await Swal.fire({
      title: '¿Desea eliminar este registro permanentemente?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    setIsSaving(true);
    try {
      let collectionName = null;
      if (activity.type === 'event') collectionName = 'events';
      else if (activity.type === 'mto') collectionName = 'mtos';
      else if (activity.type === 'reminder') collectionName = 'reminders';
      else if (activity.type === 'anniversary') collectionName = 'institutions';

      if (collectionName) {
        await deleteDoc(doc(db, collectionName, activity.id));
        fetchAllActivities();
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Real-time Clock and Date */}
      <div className="flex flex-wrap items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-sky-100">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-2xl font-black text-project-900 capitalize leading-tight">
            {format(currentTime, "EEEE d", { locale: es })}
          </h2>
          <p className="text-slate-500 text-sm font-bold capitalize">{format(currentTime, "MMMM yyyy", { locale: es })}</p>
        </div>

        <div 
          className="flex-1 text-center cursor-pointer hover:bg-sky-50 p-3 rounded-2xl transition-all"
          onClick={() => setShowTimeModal(true)}
        >
          <div className="text-5xl font-black text-project-900 font-mono tracking-tighter leading-none">
            {format(currentTime, "HH:mm:ss")}
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 mt-1">Hora Oficial Argentina</p>
        </div>

        <div 
          className="flex-1 flex justify-end items-center gap-4 cursor-pointer hover:bg-sky-50 p-3 rounded-2xl transition-all group"
          onClick={() => setShowWeatherModal(true)}
        >
          {weather ? (
            <>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900 flex items-center justify-end gap-1">
                  <Thermometer size={18} className="text-amber-500" />
                  {weather.temperature_2m}°C
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{weatherCity}</p>
              </div>
              <div className="p-3 bg-sky-100 rounded-2xl group-hover:scale-110 transition-transform">
                <Cloud size={28} className="text-project-700" />
              </div>
            </>
          ) : (
            <div className="w-8 h-8 border-2 border-project-600 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics / Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="project-card p-6 bg-white border-sky-100 shadow-sm h-fit">
            <CardCalendar activities={activities} onDayClick={handleDayClick} />
          </div>

          <div className="project-card p-6 space-y-4">
            <h4 className="font-black text-slate-900 flex items-center gap-2 uppercase text-xs tracking-widest">
              <AlertCircle size={18} className="text-red-500" /> Resumen Operativo
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Agenda Jefatura</span>
                <span className="font-black text-slate-900">{activities.filter(a => a.type === 'event' && !a.completed).length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Cumpleaños</span>
                <span className="font-black text-slate-900">{activities.filter(a => a.type === 'birthday').length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Aniversarios</span>
                <span className="font-black text-slate-900">{activities.filter(a => a.type === 'anniversary').length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Plazos MTO</span>
                <span className="font-black text-slate-900">{activities.filter(a => a.type === 'mto' && !a.completed).length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Recordatorios</span>
                <span className="font-black text-slate-900">{activities.filter(a => a.type === 'reminder' && !a.completed).length}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-bold">Instituciones</span>
                <span className="font-black text-project-700">{institutionsCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">

          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Calendar size={20} className="text-project-600" /> Cronograma de Actividades
            </h3>
            <button onClick={fetchAllActivities} className="text-xs font-bold text-project-600 hover:underline">
              Actualizar
            </button>
          </div>

          <div className="relative space-y-4">
            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="w-10 h-10 border-4 border-project-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={`${activity.type}-${activity.id}`}
                  className="flex gap-4 group"
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-2 ${getCategoryColor(activity.type, activity.category, activity.completed)} ring-4 ring-white shadow-sm z-10 transition-colors`}></div>
                    {index !== activities.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1"></div>}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className={`project-card p-5 hover:shadow-xl transition-all group-hover:border-project-200 ${activity.completed ? 'opacity-60 bg-slate-50 grayscale-[0.5]' : ''}`}>
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                        <div className="space-y-1">
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${activity.completed ? 'text-slate-400' : 'text-project-600'}`}>
                            {format(parseISO(activity.date), "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                          <h4 className={`font-black transition-colors ${activity.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {activity.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-500 bg-sky-50 px-2 py-1 rounded-lg">
                            <Clock size={12} /> {activity.time} hs
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {activity.type !== 'birthday' && (
                              <button 
                                onClick={() => handleToggleComplete(activity)}
                                className={`p-1.5 rounded-lg transition-colors ${activity.completed ? 'text-green-500 bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                title="Marcar como completado"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDelete(activity)}
                              className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className={`text-sm line-clamp-2 italic ${activity.completed ? 'text-slate-400' : 'text-slate-500'}`}>
                        {activity.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-sky-200">
                <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No hay actividades programadas próximamente</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showWeatherModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="w-full max-w-2xl project-card overflow-y-auto max-h-[95vh] m-2 sm:m-4"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-project-600 text-white">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Cloud size={20} /> Pronóstico del Clima
                  </h3>
                </div>
                <button onClick={() => setShowWeatherModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                   <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="relative">
                  <div className="relative">
                    <input 
                      className="input-field pr-12" 
                      placeholder="Escriba el nombre de una ciudad..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isSearching ? (
                        <div className="w-5 h-5 border-2 border-project-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                    </div>
                  </div>

                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[2010] overflow-hidden"
                      >
                        {searchResults.map((res) => (
                          <button
                            key={`${res.latitude}-${res.longitude}`}
                            onClick={() => fetchWeather(res.latitude, res.longitude, `${res.name}, ${res.admin1 || res.country}`)}
                            className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-none"
                          >
                            <MapPin size={16} className="text-project-600" />
                            <div>
                              <p className="font-bold text-sm">{res.name}</p>
                              <p className="text-xs text-slate-500">{res.admin1 ? `${res.admin1}, ` : ''}{res.country}</p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {weather ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="project-card p-6 bg-slate-50 border-none text-center">
                      <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Ahora en {weatherCity}</p>
                      <div className="text-6xl font-black text-project-600 my-4">{weather.temperature_2m}°C</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-xl">
                          <Wind className="mx-auto text-blue-500 mb-1" size={16} />
                          <p className="text-[10px] text-slate-500">VIENTO</p>
                          <p className="font-bold">{weather.wind_speed_10m} km/h</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl">
                          <Droplets className="mx-auto text-cyan-500 mb-1" size={16} />
                          <p className="text-[10px] text-slate-500">HUMEDAD</p>
                          <p className="font-bold">{weather.relative_humidity_2m}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Próximos 5 días</p>
                      {forecast.map((day, i) => (
                        <div key={day.date} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-sm font-bold w-12">{i === 0 ? 'Hoy' : format(parseISO(day.date), 'EEE', { locale: es })}</span>
                          <Cloud className="text-slate-400" size={20} />
                          <div className="text-sm font-bold">
                            <span className="text-red-500">{Math.round(day.max)}°</span>
                            <span className="text-slate-400 mx-2">/</span>
                            <span className="text-blue-500">{Math.round(day.min)}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-2">
                      <button 
                        onClick={shareWeatherWhatsApp}
                        className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95"
                      >
                        <Share2 size={20} /> Compartir Reporte del Clima por WhatsApp
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-project-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Cargando información meteorológica...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTimeModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="w-full max-w-lg project-card overflow-y-auto max-h-[95vh] m-2 sm:m-4"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-project-600 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock size={20} /> Reloj Mundial
                </h3>
                <button 
                  onClick={() => {
                    setShowTimeModal(false);
                    setWorldSearchQuery('');
                    setWorldSearchResults([]);
                    setSelectedWorldTime(null);
                  }} 
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="relative">
                  <input 
                    className="input-field pr-12" 
                    placeholder="Buscar ciudad (Ej. Madrid, Tokyo, New York)..." 
                    value={worldSearchQuery}
                    onChange={(e) => setWorldSearchQuery(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isSearchingTime ? (
                      <div className="w-5 h-5 border-2 border-project-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : null}
                  </div>

                  <AnimatePresence>
                    {worldSearchResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[2010] overflow-hidden"
                      >
                        {worldSearchResults.map((res) => (
                          <button
                            key={`${res.latitude}-${res.longitude}`}
                            onClick={() => {
                              setSelectedWorldTime({
                                name: res.name,
                                country: res.country,
                                admin1: res.admin1,
                                timezone: res.timezone
                              });
                              setWorldSearchResults([]);
                              setWorldSearchQuery('');
                            }}
                            className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-none"
                          >
                            <MapPin size={16} className="text-project-600" />
                            <div>
                              <p className="font-bold text-sm">{res.name}</p>
                              <p className="text-xs text-slate-500">{res.admin1 ? `${res.admin1}, ` : ''}{res.country}</p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedWorldTime ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="project-card p-8 bg-slate-50 border-none text-center space-y-4"
                  >
                    <div>
                      <h4 className="text-2xl font-black text-slate-800">{selectedWorldTime.name}</h4>
                      <p className="text-sm text-slate-600">{selectedWorldTime.admin1 ? `${selectedWorldTime.admin1}, ` : ''}{selectedWorldTime.country}</p>
                    </div>
                    <div className="text-6xl font-black text-slate-700 font-mono tracking-tighter">
                      {getWorldTime(selectedWorldTime.timezone)}
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Huso Horario: {selectedWorldTime.timezone}</p>
                    
                    <button 
                      onClick={shareWorldTimeWhatsApp}
                      className="w-full mt-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95"
                    >
                      <Share2 size={18} /> Compartir por WhatsApp
                    </button>
                  </motion.div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <div className="text-5xl font-black text-slate-700 font-mono tracking-tighter">
                      {format(currentTime, "HH:mm:ss")}
                    </div>
                    <p className="text-sm text-slate-600 font-medium italic">Busca una ciudad para ver su hora local...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-project-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Actividades</h3>
                    <p className="text-xs text-white/80 font-bold uppercase tracking-widest">
                      {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {selectedDayActivities.length > 0 ? (
                  selectedDayActivities.map((act, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-project-200 transition-colors">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-project-600 border border-slate-100">
                         <Clock size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-black text-project-600 uppercase tracking-widest">
                            {act.time} HS
                          </span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                            act.category === 'reunion' ? 'bg-blue-100 text-blue-600' :
                            act.category === 'natalicio' ? 'bg-pink-100 text-pink-600' :
                            act.category === 'plazo' ? 'bg-red-100 text-red-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {act.category || 'Evento'}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{act.title}</h4>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No hay actividades para este día</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="px-8 py-3 bg-white text-project-600 font-black text-xs rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors uppercase tracking-widest shadow-sm"
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

export default PanelPrincipal;
