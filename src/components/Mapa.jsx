import { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Trash2, Save, Share2, 
  FileText, Plus, X, Download, Cloud, Wind, Droplets, Edit2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import domtoimage from 'dom-to-image';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Click handler component
const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to fly to location
const ChangeView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

const Mapa = () => {
  const mapRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDestino, setSearchQueryDestino] = useState('');
  const [routePath, setRoutePath] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [selectedView, setSelectedView] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [weatherCity, setWeatherCity] = useState('Santa Catalina, Arg.');
  const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]); // Buenos Aires
  const [searchQueryWeather, setSearchQueryWeather] = useState('');
  const [searchResultsWeather, setSearchResultsWeather] = useState([]);
  const [isSearchingWeather, setIsSearchingWeather] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapType, setMapType] = useState('m'); 

  const fetchMarkers = async () => {
    const querySnapshot = await getDocs(collection(db, 'map_markers'));
    setMarkers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const jurisSnapshot = await getDocs(collection(db, 'jurisdictions'));
    setJurisdictions(jurisSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const viewsSnapshot = await getDocs(collection(db, 'map_views'));
    setSavedViews(viewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    const init = async () => {
      await fetchMarkers();
    };
    init();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      let originCoords = null;
      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        originCoords = [parseFloat(lat), parseFloat(lon)];
        if (!isNaN(originCoords[0]) && !isNaN(originCoords[1])) {
          setMapCenter(originCoords);
          if (!searchQueryDestino) {
            fetchWeather(lat, lon);
            setRoutePath(null);
            setRouteDistance(null);
          }
        }
      } else {
        Swal.fire('No encontrado', 'No se encontró el origen. Intente ser más específico.', 'warning');
      }

      if (searchQueryDestino && originCoords) {
        const resDest = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQueryDestino)}&limit=1`);
        if (resDest.data && resDest.data.length > 0) {
          const destCoords = [parseFloat(resDest.data[0].lat), parseFloat(resDest.data[0].lon)];
          try {
            const osrmRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`);
            if (osrmRes.data && osrmRes.data.routes && osrmRes.data.routes.length > 0) {
              const route = osrmRes.data.routes[0];
              const distanceKm = (route.distance / 1000).toFixed(2);
              const pathCoordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
              
              setRoutePath(pathCoordinates);
              setRouteDistance(distanceKm);
            } else {
              throw new Error("No route found");
            }
          } catch (e) {
            console.error("OSRM Error:", e);
            // Fallback to straight line
            setRoutePath([originCoords, destCoords]);
            const distMeters = L.latLng(originCoords).distanceTo(L.latLng(destCoords));
            setRouteDistance((distMeters / 1000).toFixed(2));
          }
          
          setMapCenter([
            (originCoords[0] + destCoords[0]) / 2,
            (originCoords[1] + destCoords[1]) / 2
          ]);
        } else {
          Swal.fire('No encontrado', 'No se encontró el destino. Intente ser más específico.', 'warning');
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Live Geocoding for Map Weather
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQueryWeather.length > 2) {
        setIsSearchingWeather(true);
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchQueryWeather}&count=5&language=es&format=json`);
          const data = await res.json();
          setSearchResultsWeather(data.results || []);
        } catch (error) {
          console.error("Geocoding error:", error);
        } finally {
          setIsSearchingWeather(false);
        }
      } else {
        setSearchResultsWeather([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQueryWeather]);

  const fetchWeather = async (lat = -34.4072, lon = -58.9135, cityName = 'Santa Catalina, Arg.') => {
    try {
      setWeatherCity(cityName);
      setSearchQueryWeather('');
      setSearchResultsWeather([]);
      const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
      const data = response.data;
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

  const addMarker = async (pos = mapCenter, name = searchQuery) => {
    const markerData = {
      position: pos,
      name: name || `Punto ${markers.length + 1}`,
      timestamp: new Date().toISOString()
    };
    await addDoc(collection(db, 'map_markers'), markerData);
    fetchMarkers();
  };

  const saveJurisdiction = async () => {
    if (currentPath.length < 2) {
      Swal.fire('Atención', 'Seleccione al menos 2 puntos en el mapa', 'info');
      return;
    }
    const { value: formValues } = await Swal.fire({
      title: 'Guardar Jurisdicción',
      html: `
        <div class="space-y-4 text-left">
          <div>
            <label class="text-sm font-bold text-slate-500">Nombre</label>
            <input id="swal-name" class="swal2-input !mx-0 !w-full" value="Jurisdicción ${jurisdictions.length + 1}">
          </div>
          <div>
            <label class="text-sm font-bold text-slate-500">Desde (Km / Lugar)</label>
            <input id="swal-from" class="swal2-input !mx-0 !w-full" placeholder="Ej: Km 120">
          </div>
          <div>
            <label class="text-sm font-bold text-slate-500">Hasta (Km / Lugar)</label>
            <input id="swal-to" class="swal2-input !mx-0 !w-full" placeholder="Ej: Km 150">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return {
          name: document.getElementById('swal-name').value,
          from: document.getElementById('swal-from').value,
          to: document.getElementById('swal-to').value
        }
      }
    });

    if (!formValues || !formValues.name) return;

    let totalDistanceMeters = 0;
    for (let i = 0; i < currentPath.length - 1; i++) {
      totalDistanceMeters += L.latLng(currentPath[i]).distanceTo(L.latLng(currentPath[i+1]));
    }
    const distanceKm = (totalDistanceMeters / 1000).toFixed(2);

    await addDoc(collection(db, 'jurisdictions'), {
      name: formValues.name,
      from: formValues.from || '',
      to: formValues.to || '',
      distance: distanceKm,
      path: currentPath,
      timestamp: new Date().toISOString()
    });
    setCurrentPath([]);
    setIsDrawing(false);
    fetchMarkers();
  };

  const deleteJurisdiction = async (id) => {
    await deleteDoc(doc(db, 'jurisdictions', id));
    fetchMarkers();
  };

  const saveView = async () => {
    const { value: name } = await Swal.fire({
      title: 'Nombre de esta vista',
      input: 'text',
      inputValue: `Mapa ${savedViews.length + 1}`,
      showCancelButton: true
    });
    if (!name) return;

    setLoading(true);
    try {
      // Capture map as image using dom-to-image (supports Leaflet SVGs better)
      const element = mapRef.current;
      const screenshot = await domtoimage.toPng(element, { bgcolor: '#ffffff' });

      await addDoc(collection(db, 'map_views'), {
        name,
        center: mapCenter,
        zoom: 13,
        type: mapType,
        screenshot, // Save the actual image
        routeOrigin: routePath ? searchQuery : null,
        routeDestination: routePath ? searchQueryDestino : null,
        routeDistance: routePath ? routeDistance : null,
        timestamp: new Date().toISOString()
      });
      fetchMarkers();
    } catch (error) {
      console.error("Error saving view image:", error);
      Swal.fire('Error', "Error al capturar la imagen del mapa.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteView = async (id) => {
    await deleteDoc(doc(db, 'map_views', id));
    fetchMarkers();
  };

  const cleanText = (str) => {
    if (!str) return '';
    return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
              .replace(/[^\x00-\xBF\x20-\x7E\xA1-\xFF]/g, '');
  };

  const exportViewPDF = (view) => {
    const doc = jsPDF();
    doc.setFillColor(0, 50, 0);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('INFORME DE CAPTURA DE MAPA', 20, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Nombre: ${cleanText(view.name)}`, 20, 55);
    doc.text(`Fecha: ${new Date(view.timestamp).toLocaleString()}`, 20, 65);
    
    let yPos = 75;
    if (view.routeDistance) {
      doc.text(`Ruta de Conducción: ${cleanText(view.routeOrigin)} -> ${cleanText(view.routeDestination)}`, 20, 75);
      doc.text(`Distancia en Ruta: ${view.routeDistance} km`, 20, 85);
      yPos = 95;
    }
    
    // Add the map screenshot to PDF
    if (view.screenshot) {
      doc.addImage(view.screenshot, 'PNG', 15, yPos, 180, 110);
    }
    
    const lineY = yPos + 120;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, lineY, 190, lineY);
    doc.setFontSize(10);
    doc.text(`Coordenadas Centrales: ${view.center.join(', ')}`, 20, lineY + 10);
    
    doc.save(`mapa_${cleanText(view.name).replace(/\s+/g, '_')}.pdf`);
  };

  const exportJurisdictionPDF = (j) => {
    const doc = new jsPDF();
    doc.setFillColor(0, 50, 0);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('INFORME DE JURISDICCIÓN GNA', 20, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Nombre: ${cleanText(j.name)}`, 20, 55);
    doc.text(`Desde: ${cleanText(j.from) || 'N/A'} - Hasta: ${cleanText(j.to) || 'N/A'}`, 20, 65);
    doc.text(`Distancia Total: ${j.distance ? j.distance + ' km' : 'N/A'}`, 20, 75);
    doc.text(`Fecha de Registro: ${new Date(j.timestamp).toLocaleString()}`, 20, 85);
    doc.text(`Trazado Magnético: Activo (Siguiendo Curva de Ruta)`, 20, 95);
    doc.text(`Coordenada Inicio: ${j.path[0].join(', ')}`, 20, 105);
    doc.text(`Coordenada Fin: ${j.path[j.path.length-1].join(', ')}`, 20, 115);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 125, 190, 125);
    
    doc.setFontSize(10);
    doc.text('Este documento certifica el trazado de la jurisdicción marcada sobre la cartografía nacional.', 20, 280);
    
    doc.save(`jurisdiccion_${cleanText(j.name).replace(/\s+/g, '_')}.pdf`);
  };


  const handleMapClick = async (lat, lng) => {
    if (isDrawing) {
      const newPoint = [lat, lng];
      
      if (currentPath.length === 0) {
        setCurrentPath([newPoint]);
      } else {
        const lastPoint = currentPath[currentPath.length - 1];
        setLoading(true);
        try {
          const response = await axios.get(
            `https://router.project-osrm.org/route/v1/driving/${lastPoint[1]},${lastPoint[0]};${newPoint[1]},${newPoint[0]}?overview=full&geometries=geojson`
          );
          
          if (response.data.routes && response.data.routes.length > 0) {
            const routeCoords = response.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            setCurrentPath(prev => [...prev, ...routeCoords]);
          } else {
            setCurrentPath(prev => [...prev, newPoint]);
          }
        } catch (error) {
          console.error("Routing error:", error);
          setCurrentPath(prev => [...prev, newPoint]);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const deleteMarker = async (id) => {
    await deleteDoc(doc(db, 'map_markers', id));
    fetchMarkers();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Jurisdicciones de Ruta Nacional - GNA', 20, 10);
    markers.forEach((m, i) => {
      doc.text(`${i+1}. ${cleanText(m.name)} - Coordenadas: ${m.position.join(', ')}`, 20, 20 + (i * 10));
    });
    doc.save('mapa_jurisdicciones.pdf');
  };

  const filteredMarkers = markers.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shareWhatsApp = () => {
    const text = `Mapa GNA: Puntos marcados - ${filteredMarkers.map(m => m.name).join(', ')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="project-card p-4">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input 
                  className="input-field w-full"
                  placeholder="Desde (Ciudad, Calle, Coordenadas...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-1 relative">
                <input 
                  className="input-field w-full"
                  placeholder="Hasta (Opcional - Calcular Distancia)"
                  value={searchQueryDestino}
                  onChange={(e) => setSearchQueryDestino(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 px-6 h-[46px] mt-auto">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : <Search size={20} />}
                <span className="hidden md:inline">{loading ? 'Buscando...' : 'Buscar'}</span>
              </button>
            </form>
          </div>

          <div ref={mapRef} className="h-[600px] rounded-2xl overflow-hidden shadow-2xl border border-sky-200 relative z-0">
            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              {mapType === 'm' && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              )}
              {mapType === 's' && (
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='&copy; Esri, Maxar, Earthstar Geographics'
                />
              )}
              {mapType === 'y' && (
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  attribution='&copy; Esri, HERE, Garmin, USGS'
                />
              )}
              <ChangeView center={mapCenter} />
              <MapEvents onMapClick={handleMapClick} />

              {filteredMarkers.map((marker) => (
                <Marker key={marker.id} position={marker.position}>
                  <Popup>
                    <div className="p-2 min-w-[150px]">
                      <h4 className="font-bold text-project-600">{marker.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{marker.position.join(', ')}</p>
                      <hr className="my-2 border-slate-100" />
                      <button 
                        onClick={() => deleteMarker(marker.id)}
                        className="w-full py-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                      >
                        <Trash2 size={12} /> Eliminar Punto
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {jurisdictions.map((j) => (
                <Polyline key={j.id} positions={j.path} color="#15803d" weight={5} dashArray="10, 15" opacity={0.8}>
                  <Popup>
                    <b>{j.name}</b><br/>
                    {j.from && j.to && <span className="text-xs text-slate-500 block">Desde: {j.from} - Hasta: {j.to}</span>}
                    {j.distance && <span className="text-xs font-bold text-project-600 block mt-1">Distancia: {j.distance} km</span>}
                  </Popup>
                </Polyline>
              ))}

              {isDrawing && currentPath.length > 0 && (
                <Polyline positions={currentPath} color="#ef4444" weight={5} dashArray="10, 15" />
              )}

              {routePath && (
                <Polyline positions={routePath} color="#3b82f6" weight={6} dashArray="15, 20" opacity={0.9}>
                  <Popup>
                    <b>Ruta Calculada</b><br/>
                    Desde: {searchQuery}<br/>
                    Hasta: {searchQueryDestino}<br/>
                    <span className="text-blue-600 font-bold">Distancia: {routeDistance} km</span>
                  </Popup>
                </Polyline>
              )}
            </MapContainer>

            {routeDistance && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-6 py-3 rounded-full shadow-2xl border border-blue-500 flex items-center gap-3 animate-fade-in text-slate-900">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-bold text-slate-900">
                  Distancia en Ruta: <span className="text-blue-700 text-lg ml-1 font-black">{routeDistance} km</span>
                </p>
              </div>
            )}

            {/* Map Controls Overlay */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <div className="bg-white rounded-xl shadow-lg border border-sky-100 overflow-hidden">
                <button onClick={() => setMapType('m')} className={`p-3 w-full border-b transition-colors ${mapType === 'm' ? 'bg-project-50 text-project-600' : 'hover:bg-slate-50'}`} title="Mapa">
                  <MapPin size={20} />
                </button>
                <button onClick={() => setMapType('s')} className={`p-3 w-full border-b transition-colors ${mapType === 's' ? 'bg-project-50 text-project-600' : 'hover:bg-slate-50'}`} title="Satélite">
                  <Cloud size={20} />
                </button>
                <button onClick={() => setMapType('y')} className={`p-3 w-full transition-colors ${mapType === 'y' ? 'bg-project-50 text-project-600' : 'hover:bg-slate-50'}`} title="Híbrido">
                  <Share2 size={20} />
                </button>
              </div>

              <button 
                onClick={() => {
                  if (isDrawing) {
                    saveJurisdiction();
                  } else {
                    setIsDrawing(true);
                  }
                }}
                className={`p-4 rounded-full shadow-2xl flex items-center justify-center transition-all ${
                  isDrawing ? 'bg-green-600 text-white animate-pulse' : 'bg-white text-slate-600 hover:text-project-700'
                }`}
                title={isDrawing ? "Finalizar Trazado" : "Dibujar Jurisdicción"}
              >
                {isDrawing ? <Save size={24} /> : <Edit2 size={24} />}
              </button>
              
              {isDrawing && (
                <button onClick={() => { setIsDrawing(false); setCurrentPath([]); }} className="p-3 bg-red-500 text-white rounded-full shadow-lg">
                  <X size={20} />
                </button>
              )}
            </div>

            {isDrawing && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-6 py-3 rounded-full shadow-2xl border border-project-500 flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                <p className="text-sm font-bold text-slate-900">
                  Modo Trazado Activo: Haga clic en el mapa para marcar los puntos de la jurisdicción
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {weather && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setShowWeatherModal(true)}
              className="project-card p-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white cursor-pointer hover:brightness-110 transition-all shadow-lg"
            >
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Cloud size={20} /> {weatherCity}
              </h3>
              <div className="flex justify-between items-center">
                <div className="text-4xl font-bold">{weather.temperature_2m}°C</div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Wind size={14} /> <span>Viento: {weather.wind_speed_10m} km/h</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <Droplets size={14} /> <span>Humedad: {weather.relative_humidity_2m}%</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-blue-100 mt-4 text-center uppercase tracking-widest font-bold">Ver pronóstico extendido</p>
            </motion.div>
          )}

          <div className="project-card p-6 space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">
              Puntos y Jurisdicciones
            </h3>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {/* Jurisdictions List */}
              {jurisdictions.map(j => (
                <div key={j.id} className="p-3 rounded-lg bg-sky-50 flex flex-col gap-2 border border-sky-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMapCenter(j.path[0])}>
                      <Share2 size={16} className="text-project-700" />
                      <span className="text-sm font-black text-slate-900 truncate max-w-[120px]">{j.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => exportJurisdictionPDF(j)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Descargar PDF">
                        <Download size={14} />
                      </button>
                      <button onClick={() => deleteJurisdiction(j.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Markers List */}
              {filteredMarkers.map(m => (
                <div key={m.id} className="p-3 rounded-lg bg-slate-50 flex justify-between items-center border border-transparent hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMapCenter(m.position)}>
                    <MapPin size={16} className="text-project-600" />
                    <span className="text-sm font-medium truncate max-w-[120px]">{m.name}</span>
                  </div>
                  <button onClick={() => deleteMarker(m.id)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <hr className="my-4 border-slate-100" />
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Vistas de Mapas Guardadas</h4>
              
              <button onClick={saveView} className="w-full py-2 mb-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-project-600 hover:border-project-300 transition-all text-xs font-bold flex items-center justify-center gap-2">
                <Save size={14} /> Guardar Vista Actual
              </button>

              {savedViews.map(v => (
                <div key={v.id} className="p-3 rounded-lg bg-sky-50 flex justify-between items-center border border-sky-100">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedView(v)}>
                    <FileText size={16} className="text-project-600" />
                    <span className="text-sm font-black text-project-900 truncate max-w-[120px]">{v.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => exportViewPDF(v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Descargar">
                      <Download size={14} />
                    </button>
                    <button onClick={() => deleteView(v.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {filteredMarkers.length === 0 && jurisdictions.length === 0 && savedViews.length === 0 && (
                <p className="text-center text-slate-400 py-4 text-sm italic">No hay registros</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4">
              <button onClick={exportPDF} className="flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                <FileText size={16} /> PDF General
              </button>
              <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                <Share2 size={16} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedView && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-4xl project-card overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold">{selectedView.name}</h3>
                  <p className="text-xs text-slate-500">Captura guardada el {new Date(selectedView.timestamp).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedView(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
              </div>
              
              <div className="h-[400px] w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                {selectedView.screenshot ? (
                  <img src={selectedView.screenshot} className="w-full h-full object-cover" alt="Captura de Mapa" />
                ) : (
                  <MapContainer center={selectedView.center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                    <Marker position={selectedView.center} />
                  </MapContainer>
                )}
                <div className="absolute inset-0 bg-transparent z-[1001]"></div>
              </div>

              <div className="p-6 flex justify-between items-center bg-slate-50">
                <div className="text-sm text-slate-500">
                  <p>Coordenadas: {selectedView.center.join(', ')}</p>
                  <p>Tipo: {selectedView.type === 'm' ? 'Mapa' : 'Satélite'}</p>
                </div>
                <button onClick={() => exportViewPDF(selectedView)} className="btn-primary flex items-center gap-2">
                  <FileText size={20} />
                  <span>Descargar Informe PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showWeatherModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-2xl project-card overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-project-600 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2"><Cloud size={20} /> Clima Detallado</h3>
                <button onClick={() => setShowWeatherModal(false)} className="p-2 hover:bg-white/20 rounded-full"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="relative">
                  <div className="relative">
                    <input 
                      className="input-field pr-12" 
                      placeholder="Buscar ciudad..." 
                      value={searchQueryWeather}
                      onChange={(e) => setSearchQueryWeather(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isSearchingWeather ? (
                        <div className="w-5 h-5 border-2 border-project-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : null}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {searchResultsWeather.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[2010] overflow-hidden">
                        {searchResultsWeather.map(res => (
                          <button key={`${res.latitude}-${res.longitude}`} onClick={() => fetchWeather(res.latitude, res.longitude, `${res.name}, ${res.admin1 || res.country}`)} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-none">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="project-card p-6 bg-slate-50 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{weatherCity}</p>
                    <div className="text-6xl font-black text-project-600 my-4">{weather.temperature_2m}°C</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-xl">
                        <Wind className="mx-auto text-blue-500 mb-1" size={16} />
                        <p className="text-[10px]">VIENTO</p>
                        <p className="font-bold">{weather.wind_speed_10m} km/h</p>
                      </div>
                      <div className="p-3 bg-white rounded-xl">
                        <Droplets className="mx-auto text-cyan-500 mb-1" size={16} />
                        <p className="text-[10px]">HUMEDAD</p>
                        <p className="font-bold">{weather.relative_humidity_2m}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Pronóstico 5 Días</p>
                    {forecast.map((day, i) => (
                      <div key={day.date} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span className="text-sm font-bold w-12">{i === 0 ? 'Hoy' : format(parseISO(day.date), 'EEE', { locale: es })}</span>
                        <Cloud className="text-slate-400" size={20} />
                        <div className="text-sm font-bold">
                          <span className="text-red-500">{Math.round(day.max)}°</span> / <span className="text-blue-500">{Math.round(day.min)}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Mapa;
