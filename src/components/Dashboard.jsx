import { useState, useEffect } from 'react';
import { 
  Calendar, Map, Users, Building2, MessageSquare, 
  LogOut, Menu, X, Bell, LayoutGrid, TrendingUp, StickyNote, Clock
} from 'lucide-react';
import { 
  format, parseISO, startOfMonth, endOfMonth, 
  eachDayOfInterval, getDay, isSameDay, isToday, startOfDay,
  isAfter, isBefore, addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import AgendaJefatura from './AgendaJefatura';
import Mapa from './Mapa';
import Cumpleaños from './Cumpleaños';
import Instituciones from './Instituciones';
import Mto from './Mto';
import BolsaValor from './BolsaValor';
import Recordatorios from './Recordatorios';
import PanelPrincipal from './PanelPrincipal';
import { useNotificationScheduler } from '../services/notificationScheduler';
import Swal from 'sweetalert2';



const Dashboard = ({ user, onLogout }) => {
  useNotificationScheduler();
  const [activeTab, setActiveTab] = useState('panel');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [activities, setActivities] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const fetchAllActivities = async () => {
    setLoadingActivities(true);
    try {
      const todayYear = new Date().getFullYear();
      
      const agendaSnap = await getDocs(collection(db, 'events'));
      const agendaData = agendaSnap.docs.map(doc => ({
        id: doc.id,
        type: 'event',
        date: doc.data().date,
        time: doc.data().time || '08:00',
        title: `Agenda: ${doc.data().title}`,
        category: 'reunion'
      }));

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
          title: `Cumpleaños: ${doc.data().name}`,
          category: 'natalicio'
        };
      }).filter(Boolean);

      const mtosSnap = await getDocs(collection(db, 'mtos'));
      const mtosData = mtosSnap.docs
        .filter(doc => doc.data().hasDeadline && doc.data().deadlineDate)
        .map(doc => ({
          id: doc.id,
          type: 'mto',
          date: doc.data().deadlineDate,
          time: doc.data().deadlineTime || '23:59',
          title: `Vencimiento MTO: ${doc.data().number}`,
          category: 'plazo'
        }));

      const remindersSnap = await getDocs(collection(db, 'reminders'));
      const remindersData = remindersSnap.docs.map(doc => ({
        id: doc.id,
        type: 'reminder',
        date: doc.data().date,
        time: doc.data().time,
        title: `Recordatorio: ${doc.data().title}`,
        category: 'recordatorio'
      }));

      const instSnap = await getDocs(collection(db, 'institutions'));
      const anniversariesData = instSnap.docs.map(doc => {
        const creationDate = doc.data().creationDate;
        if (!creationDate || !creationDate.includes('-')) return null;
        const [, month, day] = creationDate.split('-');
        return {
          id: doc.id,
          type: 'anniversary',
          date: `${todayYear}-${month}-${day}`,
          time: '00:00',
          title: `Aniversario: ${doc.data().name}`,
          category: 'aniversario'
        };
      }).filter(Boolean);

      const all = [...agendaData, ...birthdaysData, ...mtosData, ...remindersData, ...anniversariesData];
      setActivities(all);
    } catch (error) {
      console.error("Error fetching activities for dashboard:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchAllActivities();
    const interval = setInterval(fetchAllActivities, 600000); // 10 min
    return () => clearInterval(interval);
  }, []);

  const upcomingActivities = activities
    .filter(act => {
      const actDate = parseISO(act.date);
      const now = startOfDay(new Date());
      const limit = addDays(now, 8); // Include the 7th day fully
      return (isSameDay(actDate, now) || isAfter(actDate, now)) && isBefore(actDate, limit);
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { id: 'panel', icon: LayoutGrid, label: 'Panel Principal' },
    { id: 'agenda', icon: Calendar, label: 'Agenda Jefatura' },
    { id: 'mapa', icon: Map, label: 'Mapa Nacional' },
    { id: 'cumpleaños', icon: Users, label: 'Cumpleaños Personal' },
    { id: 'instituciones', icon: Building2, label: 'Instituciones' },
    { id: 'mto', icon: MessageSquare, label: 'Registro MTO' },
    { id: 'recordatorios', icon: StickyNote, label: 'Recordatorios' },
    { id: 'bolsa', icon: TrendingUp, label: 'Bolsa de Valor' }
  ];

  const handleLogoutClick = () => {
    Swal.fire({
      title: '¿Cerrar Sesión?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    }).then((result) => {
      if (result.isConfirmed) onLogout();
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth < 1024 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? '280px' : '0px',
          x: isSidebarOpen ? 0 : -280
        }}
        className="fixed lg:relative h-full bg-white border-r border-slate-200 z-50 overflow-hidden shadow-2xl lg:shadow-none"
      >
        <div className="h-full flex flex-col w-[280px]">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Ayudantía</h1>
              <p className="text-[10px] font-black text-project-600 uppercase tracking-widest mt-1">Sist. Gestión GNA</p>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 font-bold group ${
                  activeTab === item.id 
                    ? 'bg-project-600 text-white shadow-xl shadow-project-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon size={22} className={activeTab === item.id ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-sm uppercase tracking-tighter">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-project-600 flex items-center justify-center text-white font-black">
                  {user?.name?.[0]}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-black text-slate-900 truncate uppercase">{user?.jerarquía} {user?.name?.split(',')[0]}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate">Sesión Activa</p>
                </div>
              </div>
            </div>
            <button 
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-rose-600 hover:bg-rose-50 transition-all font-black group"
            >
              <LogOut size={22} className="group-hover:translate-x-1 transition-transform" />
              <span className="text-xs uppercase tracking-widest">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-30 shrink-0">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`p-3 hover:bg-slate-50 rounded-2xl transition-all ${isSidebarOpen ? 'hidden lg:hidden' : 'block'}`}
            >
              <Menu size={24} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-3 hover:bg-slate-50 rounded-2xl transition-all relative group"
              >
                <Bell size={22} className="text-slate-500 group-hover:text-project-600" />
                {upcomingActivities.length > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                    {upcomingActivities.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowNotifications(false)}
                      className="fixed inset-0 z-40"
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-96 bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Próximos 7 Días</h3>
                          <span className="text-[10px] font-black bg-project-600 text-white px-3 py-1 rounded-full border border-project-500 uppercase tracking-widest">
                            {upcomingActivities.length} Alertas
                          </span>
                        </div>
                      </div>
                      <div className="max-h-[450px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {loadingActivities ? (
                          <div className="py-12 text-center">
                            <div className="w-10 h-10 border-4 border-project-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando Actividades...</p>
                          </div>
                        ) : upcomingActivities.length > 0 ? (
                          upcomingActivities.map((act) => (
                            <div key={act.id} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-project-200 transition-all group">
                              <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                                  act.type === 'event' ? 'bg-sky-100 text-sky-600' :
                                  act.type === 'birthday' ? 'bg-pink-100 text-pink-600' :
                                  act.type === 'reminder' ? 'bg-indigo-100 text-indigo-600' :
                                  'bg-amber-100 text-amber-600'
                                }`}>
                                  {act.type === 'event' ? <Calendar size={18} /> : 
                                   act.type === 'birthday' ? <Users size={18} /> : 
                                   act.type === 'reminder' ? <Bell size={18} /> : 
                                   <Clock size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-900 group-hover:text-project-600 transition-colors truncate">
                                    {act.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                      <Calendar size={10} />
                                      {format(parseISO(act.date), 'dd MMM')}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={10} />
                                      {act.time} hs
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Bell size={32} className="text-slate-200" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay actividades próximas</p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                        <button 
                          onClick={() => setShowNotifications(false)}
                          className="text-[10px] font-black text-slate-400 hover:text-project-600 uppercase tracking-widest transition-colors"
                        >
                          Cerrar Notificaciones
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeTab === 'panel' && <PanelPrincipal />}
              {activeTab === 'agenda' && <AgendaJefatura />}
              {activeTab === 'mapa' && <Mapa />}
              {activeTab === 'cumpleaños' && <Cumpleaños />}
              {activeTab === 'instituciones' && <Instituciones />}
              {activeTab === 'mto' && <Mto />}
              {activeTab === 'recordatorios' && <Recordatorios />}
              {activeTab === 'bolsa' && <BolsaValor />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
