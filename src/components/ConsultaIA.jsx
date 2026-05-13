import { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, Sparkles, Zap,
  FileText, Calendar, ShieldCheck, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

const ConsultaIA = () => {
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      content: '¡Bienvenido! Soy el Asistente Inteligente de la Ayudantía GNA. Puedo ayudarte a redactar documentos, organizar tu agenda o consultar normativas. ¿En qué puedo asistirte hoy?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { 
      role: 'user', 
      content: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI Processing
    setTimeout(() => {
      let aiResponse;
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes('hola') || lowerInput.includes('buen')) {
        aiResponse = "Hola. Estoy listo para procesar sus requerimientos de oficina. ¿Desea redactar un MTO, organizar una reunión o consultar el estado de las instituciones?";
      } else if (lowerInput.includes('redactar') || lowerInput.includes('mto')) {
        aiResponse = "Entendido. Para redactar un MTO profesional, necesito el tema principal y el destinatario. También puedo sugerirle un formato institucional basado en la normativa vigente.";
      } else if (lowerInput.includes('recordatorio') || lowerInput.includes('agenda')) {
        aiResponse = "Puedo ayudarle a priorizar sus tareas. ¿Desea que analice su cronograma de las próximas 48 horas para detectar posibles solapamientos?";
      } else if (lowerInput.includes('gracias')) {
        aiResponse = "Es un honor servir a la Gendarmería Nacional. Quedo a su entera disposición para cualquier otra consulta técnica o administrativa.";
      } else {
        aiResponse = "He analizado su solicitud. Como asistente de IA especializado en Ayudantía, le sugiero proceder con un análisis detallado de la normativa aplicable o bien puedo generar un borrador preliminar para su revisión.";
      }

      const aiMessage = { 
        role: 'ai', 
        content: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const quickPrompts = [
    { text: "Redactar nota de elevación", icon: FileText },
    { text: "Resumir agenda de hoy", icon: Calendar },
    { text: "Normativa de MTOs", icon: ShieldCheck },
    { text: "Nuevas directivas GNA", icon: Zap }
  ];

  const clearChat = async () => {
    const result = await Swal.fire({
      title: '¿Desea limpiar el historial de la consulta?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      setMessages([messages[0]]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-h-[800px] bg-white rounded-3xl border-2 border-slate-300 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-project-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-project-600/30">
              <Bot size={28} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
          </div>
          <div>
            <h3 className="font-black text-project-900 text-lg">Inteligencia Artificial GNA</h3>
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-amber-500" />
              <span className="text-xs text-project-700 font-black uppercase tracking-widest">Motor de Procesamiento Avanzado</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"

          title="Limpiar Conversación"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]">
        {messages.map((msg, index) => (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-project-100 text-project-700'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="space-y-1">
                <div className={`p-4 rounded-2xl shadow-sm text-sm font-bold leading-relaxed ${
                  msg.role === 'user' 
                  ? 'bg-project-600 text-white rounded-tr-none' 
                  : 'bg-white text-project-900 rounded-tl-none border-2 border-sky-100'
                }`}>
                  {msg.content}
                </div>
                <p className={`text-[10px] text-slate-400 font-black uppercase ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.time}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-lg bg-project-100 text-project-700 flex items-center justify-center flex-shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border-2 border-sky-100 flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Area */}
      <div className="p-6 bg-white border-t border-slate-100 space-y-4">
>
        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {quickPrompts.map((prompt, i) => (
            <button 
              key={i}
              onClick={() => setInput(prompt.text)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-50 hover:bg-sky-100 text-project-900 border border-sky-200 rounded-full text-xs font-black whitespace-nowrap transition-all active:scale-95"
            >
              <prompt.icon size={14} />
              {prompt.text}
            </button>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="relative">
          <input 
            type="text"
            className="w-full bg-sky-50 border-2 border-sky-100 rounded-2xl py-4 pl-6 pr-14 focus:ring-4 focus:ring-project-500/20 focus:border-project-500 outline-none transition-all text-project-900 placeholder:text-project-400 font-black"
            placeholder="Escriba su consulta administrativa aquí..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-project-600 text-white rounded-xl hover:bg-project-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-project-600/20 active:scale-90"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          <ShieldCheck size={12} /> Procesamiento de datos seguro y encriptado
        </div>
      </div>
    </div>
  );
};

export default ConsultaIA;
