# Sistema de Ayudantía - Gendarmería Nacional

Este sistema ha sido diseñado como una solución integral para la gestión de ayudantía, con una estética premium, moderna y responsive.

## 🚀 Características Principales

### 1. Sistema de Autenticación (Login)
- **Seguridad**: Acceso mediante MI (Usuario) y CE (Clave).
- **Datos de Acceso**: Configurado con los usuarios solicitados:
  - José Marcelo SKIEBACK (27433769)
  - Germán Andrés RAMIREZ PEDERNERA (32559315)
  - Noelia RIVAS (29339676)
- **Diseño**: Logo circular de Gendarmería Nacional y estética de alta gama.

### 2. Agenda de Jefatura
- **Calendario Interactivo**: Visualización de eventos, reuniones y natalicios.
- **Gestión de Eventos**: Guardar, editar y eliminar.
- **Notificaciones**: Integración con Bot de Telegram para recordatorios de 24 horas.
- **Exportación**: Descarga de agenda en PDF y opción de compartir vía WhatsApp.

### 3. Mapa Nacional y Jurisdicciones
- **Interactividad**: Mapa basado en Leaflet con búsqueda de localidades.
- **Trazados**: Marcación de jurisdicciones y puntos de interés.
- **Clima**: Información meteorológica en tiempo real según el punto seleccionado.
- **Exportación**: Generación de reportes PDF y envío por WhatsApp.

### 4. Gestión de Personal (Cumpleaños)
- **Registro Completo**: Jerarquía, nombre, MI, CE, teléfono y estado civil.
- **Cálculo Automático**: Edad calculada en tiempo real según fecha de nacimiento.
- **Buscador en Vivo**: Filtrado instantáneo por cualquier campo.
- **Notificaciones**: Avisos de cumpleaños vía Telegram (24h de antelación).

### 5. Instituciones
- **Registro Detallado**: Fecha de creación, años de antigüedad, jefatura y secretaría.
- **Ubicación**: Ventana modal con mapa de ubicación por dirección.
- **Multi-teléfono**: Soporte para múltiples números de contacto.

### 6. Registro MTO (Mensajes de Tráfico Oficial)
- **Control de Tráfico**: Registro de mensajes enviados y recibidos.
- **Seguimiento**: Control de cumplimiento mediante tilde de cumplimentación.
- **Plazos**: Gestión de fechas límite con recordatorios automáticos vía Telegram.

## 🛠️ Tecnologías Utilizadas
- **Frontend**: React.js + Vite.
- **Estilos**: Tailwind CSS (Diseño Premium).
- **Backend**: Firebase (Firestore, Auth, Storage).
- **Mapas**: React-Leaflet.
- **Reportes**: jsPDF + jsPDF-AutoTable.
- **Iconografía**: Lucide React.
- **Notificaciones**: Telegram Bot API.

## 📦 Instrucciones para Ejecutar Localmente
1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta `npm install` para instalar todas las dependencias.
3. Ejecuta `npm run dev` para iniciar el servidor de desarrollo.
4. Abre `http://localhost:5173` en tu navegador.

---
**Nota sobre Telegram**: Para que los recordatorios funcionen, asegúrate de configurar el Chat ID correspondiente en cada componente que lo solicite.
