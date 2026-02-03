import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { RefreshCw, Vote, Users, MapPin, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import Papa from 'papaparse';
import Participacion from './components/Participacion';

const CORPORATE_COLOR = '#01f3b3';
const CORPORATE_DARK = '#00d9a0';
const CORPORATE_GLOW = '0 0 20px rgba(1, 243, 179, 0.3)';

// Formateo de numeros
const formatPercentEs = (value) => {
  const num = Number(String(value).replace('%', '').replace(',', '.'));
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('es-ES', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

// Normalizar textos
const normalizeStr = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const makeMunicipioKey = (nombre, provincia) =>
  `${normalizeStr(nombre)}|${normalizeStr(provincia)}`;

// Utilidades para el hemiciclo
const degToRad = (deg) => (deg * Math.PI) / 180;

const polarToCartesian = (cx, cy, radius, angleDeg) => {
  const rad = degToRad(angleDeg);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy - radius * Math.sin(rad),
  };
};

const describeArc = (cx, cy, innerR, outerR, startAngle, endAngle) => {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweep = endAngle > startAngle ? 0 : 1;
  const sweepInner = sweep ? 0 : 1;

  return [
    'M', outerStart.x, outerStart.y,
    'A', outerR, outerR, 0, largeArc, sweep, outerEnd.x, outerEnd.y,
    'L', innerEnd.x, innerEnd.y,
    'A', innerR, innerR, 0, largeArc, sweepInner, innerStart.x, innerStart.y,
    'Z',
  ].join(' ');
};

// Componente de numero animado
const AnimatedNumber = ({ value, suffix = '', className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(value, increment * step);
      setDisplayValue(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={className}>
      {formatPercentEs(displayValue)}{suffix}
    </span>
  );
};

// Componente Card para tema claro
const GlassCard = ({ children, className = '', title, icon: Icon, glow = false }) => (
  <div
    className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white ${className}`}
    style={{
      boxShadow: glow
        ? `0 4px 24px rgba(1, 243, 179, 0.15), 0 1px 3px rgba(0,0,0,0.08)`
        : '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.08)',
    }}
  >
    {/* Acento decorativo */}
    <div
      className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
      style={{ background: `linear-gradient(90deg, ${CORPORATE_COLOR} 0%, ${CORPORATE_DARK} 100%)` }}
    />

    {title && (
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {Icon && (
            <div
              className="p-2 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${CORPORATE_COLOR}22 0%, ${CORPORATE_COLOR}11 100%)`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: CORPORATE_DARK }} />
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
      </div>
    )}
    <div className="p-4 relative z-10">{children}</div>
  </div>
);

// Stat Card para tema claro
const StatCard = ({ label, value, suffix = '', trend, trendValue }) => (
  <div
    className="relative p-4 rounded-xl overflow-hidden group hover:scale-[1.02] transition-all duration-300 bg-white border border-slate-200"
    style={{
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    }}
  >
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: `radial-gradient(circle at center, ${CORPORATE_COLOR}15 0%, transparent 70%)` }}
    />
    <p className="text-xs text-slate-500 mb-1 font-medium">{label}</p>
    <p
      className="text-2xl font-black"
      style={{ color: CORPORATE_DARK }}
    >
      <AnimatedNumber value={value} suffix={suffix} />
    </p>
    {trend && (
      <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{trendValue}</span>
      </div>
    )}
  </div>
);

// Tooltip personalizado para graficos
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="px-4 py-3 rounded-xl border border-slate-200 bg-white"
      style={{
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
      }}
    >
      <p className="font-bold text-slate-700 text-sm mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: CORPORATE_DARK }}>
        {formatPercentEs(payload[0].value)}%
      </p>
    </div>
  );
};

// Tick personalizado
const CustomXAxisTick = ({ x, y, payload }) => {
  const raw = String(payload?.value ?? '');
  const parts = raw.split('-').filter(Boolean);

  let line1 = raw;
  let line2 = '';

  if (parts.length >= 2) {
    line1 = parts[0];
    line2 = parts.slice(1).join('-');
  } else if (raw.length > 8) {
    const mid = Math.ceil(raw.length / 2);
    line1 = raw.slice(0, mid);
    line2 = raw.slice(mid);
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={500}>
        <tspan x="0" dy="14">{line1}</tspan>
        {line2 && <tspan x="0" dy="13">{line2}</tspan>}
      </text>
    </g>
  );
};

const App = () => {
  const [partidosData, setPartidosData] = useState([]);
  const [votosData, setVotosData] = useState([]);
  const [participacionData, setParticipacionData] = useState([]);
  const [municipiosInfo, setMunicipiosInfo] = useState({});
  const [escrutinio, setEscrutinio] = useState(0);
  const [lastUpdate, setLastUpdate] = useState('');
  const [lastFetch, setLastFetch] = useState(null); // Hora de ultima carga de datos
  const [isLoading, setIsLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadIdRef = useRef(0);

  // URLs de Google Sheets
  const URLS = {
    escanos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZMjykDggme0HIzUK4C3zzI795JBg1JxVPXxvpNCK5bK39Q6S9qqKcpPuAbYRXi9pPYADuM-3Q2Qsk/pub?gid=877884979&single=true&output=csv',
    votos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=1329011177&single=true&output=csv',
    estado: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZMjykDggme0HIzUK4C3zzI795JBg1JxVPXxvpNCK5bK39Q6S9qqKcpPuAbYRXi9pPYADuM-3Q2Qsk/pub?gid=1181648817&single=true&output=csv',
    municipios: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTfSc7iiZ_v6A3p77NS6-ebgfWz_sKcE3pIilAOACBjmHdRI1teGlTlXBR3agtmYZtRpVTP5RcdP17/pub?gid=1638668905&single=true&output=csv',
    participacion: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZMjykDggme0HIzUK4C3zzI795JBg1JxVPXxvpNCK5bK39Q6S9qqKcpPuAbYRXi9pPYADuM-3Q2Qsk/pub?gid=1075967663&single=true&output=csv',
  };

  const fetchWithNoCache = async (url) => {
    // Multiples parametros anti-cache para forzar datos frescos de Google Sheets
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const noCacheUrl = `${url}&_t=${timestamp}&_r=${random}&_uuid=${uuid}&cachebust=${timestamp}`;

    const response = await fetch(noCacheUrl, {
      cache: 'reload',
      credentials: 'omit',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };

  const parseCSV = (text) => new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });

  const processEscanos = (data) => data
    .filter((row) => row.Partido?.trim())
    .map((row) => ({
      nombre: row.Partido.trim(),
      escanos2023: parseInt(row['2023']) || 0,
      escanos2025: parseInt(row['2025']) || 0,
      cambio: (parseInt(row['2025']) || 0) - (parseInt(row['2023']) || 0),
      lado: parseInt(row.lado || row.Lado || '0'),
      color: row.color ? `#${row.color.replace('#', '')}` : '#94a3b8',
    }))
    .sort((a, b) => b.escanos2025 - a.escanos2025);

  const processVotos = (data) => data
    .filter((row) => row.siglas?.trim())
    .map((row) => ({
      nombre: row.siglas.trim(),
      porcentaje: parseFloat(String(row.porcentaje).replace('%', '').replace(',', '.')) || 0,
      color: row.color ? (row.color.startsWith('#') ? row.color : `#${row.color}`) : '#94a3b8',
    }))
    .sort((a, b) => b.porcentaje - a.porcentaje);

  const processEstado = (data) => {
    if (!data?.length) return { escrutinio: 0, lastUpdate: '' };
    const row = data[0];
    const escrutadoStr = String(row.escrutado || row.Escrutado || '0').replace('%', '').replace(',', '.').trim();
    const escruNum = parseFloat(escrutadoStr) || 0;
    const dia = row.dia || row.Dia || row.fecha || '';
    const hora = row.hora || row.Hora || '';
    let updateStr = '';
    if (dia && hora) {
      const parts = String(dia).split(/[\/\-.]/);
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const date = new Date(y, m - 1, d);
          const mes = date.toLocaleString('es-ES', { month: 'long' });
          updateStr = `${d} de ${mes} de ${y} a las ${hora}`;
        }
      }
    }
    return { escrutinio: escruNum, lastUpdate: updateStr };
  };

  const processMunicipios = (data) => {
    const map = {};
    (data || []).forEach((row) => {
      const nombre = row.municipio_nombre || row.MUNICIPIO || row.municipio || '';
      const provincia = row.PROVINCIA || row.provincia || '';
      if (!nombre || !provincia) return;
      const key = makeMunicipioKey(nombre, provincia);
      map[key] = { siglas_1: row.siglas_1 || row.SIGLAS_1 || '', raw: row };
    });
    return map;
  };

  const processParticipacion = (data) => data
    .filter((row) => row.territorio)
    .map((row) => {
      const territorio = (row.territorio || '').trim();
      const isAragon = normalizeStr(territorio) === 'aragon';
      // Parsear participación manejando comas como separador decimal
      const participacionStr = String(row.participacion || '0').replace('%', '').replace(',', '.').trim();
      const participacionNum = parseFloat(participacionStr);
      return {
        hora_minuto: row.hora || '',
        ambito: isAragon ? 'Comunidad' : 'Provincia',
        nombre_ambito: territorio,
        mesas_totales: parseInt(String(row.mesas).replace(/\./g, '')) || 0,
        censo_total: parseInt(String(row.censo).replace(/\./g, '')) || 0,
        participacion: isNaN(participacionNum) ? 0 : participacionNum,
      };
    });

  const loadAllData = useCallback(async (isRefresh = false) => {
    const currentLoadId = ++loadIdRef.current;

    if (isRefresh) setIsRefreshing(true);
    else { setIsLoading(true); setDataReady(false); }

    try {
      const [escanosText, votosText, estadoText, municipiosText, participacionText] = await Promise.all([
        fetchWithNoCache(URLS.escanos),
        fetchWithNoCache(URLS.votos),
        fetchWithNoCache(URLS.estado),
        fetchWithNoCache(URLS.municipios),
        fetchWithNoCache(URLS.participacion),
      ]);

      if (currentLoadId !== loadIdRef.current) return;

      const [escanosData, votosData, estadoData, municipiosData, participacionData] = await Promise.all([
        parseCSV(escanosText),
        parseCSV(votosText),
        parseCSV(estadoText),
        parseCSV(municipiosText),
        parseCSV(participacionText),
      ]);

      if (currentLoadId !== loadIdRef.current) return;

      const processedEscanos = processEscanos(escanosData);
      const processedVotos = processVotos(votosData);
      const { escrutinio: processedEscrutinio, lastUpdate: processedUpdate } = processEstado(estadoData);
      const processedMunicipios = processMunicipios(municipiosData);
      const processedParticipacion = processParticipacion(participacionData);

      setPartidosData(processedEscanos);
      setVotosData(processedVotos);
      setEscrutinio(processedEscrutinio);
      setLastUpdate(processedUpdate);
      setMunicipiosInfo(processedMunicipios);
      setParticipacionData(processedParticipacion);
      setLastFetch(new Date()); // Registrar hora de carga
      setDataReady(true);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      if (currentLoadId === loadIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // Cargar datos inmediatamente al montar el componente
    loadAllData(false);

    // Actualizar automaticamente cada 5 minutos
    const interval = setInterval(() => loadAllData(true), 300000);

    // Recargar datos cuando la pagina vuelve a ser visible (cambio de pestana)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAllData(true);
      }
    };

    // Recargar datos cuando la pagina recupera el foco
    const handleFocus = () => {
      loadAllData(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAllData]);

  const escanosData = partidosData.filter((p) => p.escanos2025 > 0 || p.escanos2023 > 0);
  const totalEscanos = 67;
  const mayoria = 34;

  const leftParties = escanosData.filter((p) => p.lado === 1).sort((a, b) => b.escanos2025 - a.escanos2025);
  const rightParties = escanosData.filter((p) => p.lado === 2).sort((a, b) => a.escanos2025 - b.escanos2025);
  const orderedParties = [...leftParties, ...rightParties];

  const cx = 200, cy = 200, outerR = 180, innerR = 100;
  const majorityAngle = totalEscanos > 0 ? 180 - (mayoria / totalEscanos) * 180 : 180;
  const majorityStart = polarToCartesian(cx, cy, innerR - 10, majorityAngle);
  const majorityEnd = polarToCartesian(cx, cy, outerR + 10, majorityAngle);

  // Pantalla de carga
  if (isLoading && !dataReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center overflow-hidden">
        {/* Fondo animado */}
        <div className="absolute inset-0">
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{ background: `${CORPORATE_COLOR}20` }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{ background: `${CORPORATE_COLOR}10`, animationDelay: '1s' }}
          />
        </div>

        <div className="relative z-10 text-center">
          <div className="relative w-32 h-32 mx-auto mb-8">
            {/* Anillos giratorios */}
            <div
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                border: `3px solid ${CORPORATE_COLOR}`,
                borderTopColor: CORPORATE_DARK,
                animationDuration: '1s'
              }}
            />
            <div
              className="absolute inset-4 rounded-full animate-spin"
              style={{
                border: `3px solid ${CORPORATE_COLOR}44`,
                borderTopColor: CORPORATE_COLOR,
                animationDuration: '1.5s',
                animationDirection: 'reverse'
              }}
            />
            <div
              className="absolute inset-8 rounded-full animate-spin"
              style={{
                border: `3px solid ${CORPORATE_COLOR}22`,
                borderTopColor: CORPORATE_COLOR,
                animationDuration: '2s'
              }}
            />
            {/* Centro con icono */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Vote className="w-10 h-10" style={{ color: CORPORATE_DARK }} />
            </div>
          </div>

          <h2 className="text-3xl font-black text-slate-800 mb-2">Elecciones Aragón</h2>
          <p className="text-slate-500">Cargando datos electorales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 overflow-hidden">

      {/* Header */}
      <header className="relative z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-800">Elecciones Aragón</h1>
                <p className="text-sm text-slate-500">Cortes de Aragón 2026</p>
              </div>
            </div>

            <button
              onClick={() => loadAllData(true)}
              disabled={isRefreshing}
              className="group flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-black transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: `linear-gradient(135deg, ${CORPORATE_COLOR} 0%, ${CORPORATE_DARK} 100%)`,
                boxShadow: '0 4px 14px rgba(1, 243, 179, 0.3)'
              }}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </header>

      {/* Barra de escrutinio hero */}
      <div className="relative z-40 py-4 bg-white/50 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-slate-500 text-sm uppercase tracking-widest mb-2 font-semibold">Escrutinio en directo</p>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-5xl font-black"
                  style={{ color: CORPORATE_DARK }}
                >
                  <AnimatedNumber value={escrutinio} suffix="%" />
                </span>
              </div>
              {lastUpdate && (
                <p className="text-slate-500 mt-2">Actualizado: {lastUpdate}</p>
              )}
            </div>

            <div className="flex-1 max-w-xl">
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                  style={{
                    width: `${escrutinio}%`,
                    background: `linear-gradient(90deg, ${CORPORATE_COLOR} 0%, ${CORPORATE_DARK} 100%)`,
                  }}
                >
                  {/* Efecto de brillo que se mueve */}
                  <div
                    className="absolute inset-0 animate-shimmer"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <main className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Grid principal */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

          {/* Hemiciclo */}
          <GlassCard title="Distribución de escaños (total 67)" icon={Vote} glow>
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 400 240" className="w-full max-w-lg">
                {/* Definiciones de gradientes y efectos */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <linearGradient id="majorityLine" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#000000" stopOpacity="1"/>
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.5"/>
                  </linearGradient>
                </defs>

                {/* Fondo del hemiciclo */}
                <path d={describeArc(cx, cy, innerR, outerR, 180, 0)} fill="#f1f5f9" />

                {/* Segmentos de partidos */}
                {totalEscanos > 0 && (() => {
                  let acc = 0;
                  return orderedParties.map((p, idx) => {
                    const startAngle = 180 - (acc / totalEscanos) * 180;
                    const endAngle = 180 - ((acc + p.escanos2025) / totalEscanos) * 180;
                    acc += p.escanos2025;

                    const midAngle = (startAngle + endAngle) / 2;
                    const midR = (innerR + outerR) / 2;
                    const labelPos = polarToCartesian(cx, cy, midR, midAngle);

                    return (
                      <g key={`seg-${p.nombre}-${idx}`} className="transition-all duration-300 hover:opacity-80" filter="url(#glow)">
                        <path
                          d={describeArc(cx, cy, innerR, outerR, startAngle, endAngle)}
                          fill={p.color}
                          stroke="rgba(0,0,0,0.3)"
                          strokeWidth={1}
                        />
                        {p.escanos2025 >= 3 && (
                          <text
                            x={labelPos.x}
                            y={labelPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#ffffff"
                            fontSize="16"
                            fontWeight="bold"
                            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                          >
                            {p.escanos2025}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}

                {/* Linea de mayoria con glow */}
                <line
                  x1={majorityStart.x}
                  y1={majorityStart.y}
                  x2={majorityEnd.x}
                  y2={majorityEnd.y}
                  stroke="url(#majorityLine)"
                  strokeWidth={3}
                  strokeDasharray="8,4"
                  filter="url(#glow)"
                />

                {/* Texto central */}
                <text x={cx} y={cy - 25} textAnchor="middle" fill="#64748b" fontSize="13">
                  Mayoria absoluta
                </text>
                <text x={cx} y={cy} textAnchor="middle" fill={CORPORATE_DARK} fontSize="24" fontWeight="bold">
                  {mayoria}
                </text>
                <text x={cx} y={cy + 18} textAnchor="middle" fill="#94a3b8" fontSize="12">
                  escanos
                </text>
              </svg>

              {/* Leyenda con hover */}
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {escanosData.map((p) => (
                  <div
                    key={p.nombre}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 transition-all duration-300 cursor-default bg-slate-50 text-xs"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-slate-600">{p.nombre}</span>
                    <span className="font-bold text-slate-800">{p.escanos2025}</span>
                  </div>
                ))}
              </div>

              {/* Tabla */}
              <div className="w-full mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 font-semibold text-slate-500 text-xs">Partido</th>
                      <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">2025</th>
                      <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">2023</th>
                      <th className="text-center py-2 px-2 font-semibold text-slate-500 text-xs">Var.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escanosData.map((p) => (
                      <tr key={p.nombre} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="font-medium text-slate-700">{p.nombre}</span>
                          </div>
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className="text-base font-bold" style={{ color: CORPORATE_DARK }}>{p.escanos2025}</span>
                        </td>
                        <td className="text-center py-2 px-2 text-slate-500">{p.escanos2023}</td>
                        <td className="text-center py-2 px-2">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                            p.cambio > 0
                              ? 'bg-emerald-100 text-emerald-600'
                              : p.cambio < 0
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.cambio > 0 && <TrendingUp className="w-2.5 h-2.5" />}
                            {p.cambio < 0 && <TrendingDown className="w-2.5 h-2.5" />}
                            {p.cambio > 0 ? '+' : ''}{p.cambio}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </GlassCard>

          {/* Grafico de Votos - Flourish */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white flex flex-col"
            style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{ background: `linear-gradient(90deg, ${CORPORATE_COLOR} 0%, ${CORPORATE_DARK} 100%)` }}
            />
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${CORPORATE_COLOR}22 0%, ${CORPORATE_COLOR}11 100%)` }}
                >
                  <BarChart3 className="w-4 h-4" style={{ color: CORPORATE_DARK }} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Porcentaje de votos</h2>
              </div>
            </div>
            <div className="p-4 flex-1 min-h-0">
              <iframe
                title="Porcentaje de Votos Aragon"
                src="https://flo.uri.sh/visualisation/27407624/embed"
                scrolling="no"
                frameBorder="0"
                allowFullScreen
                className="w-full h-full"
                style={{ border: 'none', minHeight: '400px' }}
              />
            </div>
          </div>
        </div>

        {/* Mapa */}
        <GlassCard title="Resultados por municipio en las elecciones de Aragón 2026" icon={MapPin} className="mb-6">
          <div className="w-full overflow-hidden flex justify-center h-[450px] xl:h-[750px]">
            <iframe
              title="Mapa Electoral Aragon"
              src="https://flo.uri.sh/visualisation/27396812/embed"
              scrolling="no"
              frameBorder="0"
              allowFullScreen
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />
          </div>
        </GlassCard>

        {/* Participacion Electoral */}
        <GlassCard title="Participación electoral" icon={Users}>
          <Participacion participacionData={participacionData} />
        </GlassCard>
      </main>
    </div>
  );
};

export default App;
