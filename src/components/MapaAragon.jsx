import React, { useState, useEffect, useMemo, useRef } from 'react';

const CORPORATE_COLOR = '#01f3b3';

const MapaAragon = ({ municipioInfo }) => {
  const [geoData, setGeoData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);

  const formatPct = (value) => {
    const num = Number(String(value).replace('%', '').replace(',', '.'));
    if (Number.isNaN(num)) return value;
    return num.toLocaleString('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const normalizeStr = (str) =>
    String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const makeMunicipioKey = (nombre, provincia) =>
    `${normalizeStr(nombre)}|${normalizeStr(provincia)}`;

  // Actualizacion suave del tooltip con requestAnimationFrame
  const updateTooltipPosition = (x, y) => {
    positionRef.current = { x, y };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate3d(${x + 20}px, ${y - 10}px, 0)`;
      }
    });
  };

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    const geojsonUrl = `${base.endsWith('/') ? base : `${base}/`}mapa_municipios.geojson`;

    setIsLoading(true);
    fetch(geojsonUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando GeoJSON:', err);
        setIsLoading(false);
      });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const COLORS = {
    PSOE: '#dc2626',
    PP: '#2563eb',
    VOX: '#16a34a',
    PAR: '#eab308',
    CHA: '#059669',
    'PODEMOS-IU': '#a855f7',
    PODEMOS: '#a855f7',
    CS: '#f97316',
    'TERUEL EXISTE': '#ec4899',
    IU: '#b91c1c',
  };

  const DEFAULT_COLOR = '#475569';

  const { features, bounds, svgWidth, svgHeight } = useMemo(() => {
    const fc = geoData || {};
    const features = Array.isArray(fc.features) ? fc.features : [];

    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const updateBounds = (lng, lat) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    const walkCoords = (coords) => {
      if (!Array.isArray(coords)) return;
      if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        coords.forEach(([lng, lat]) => updateBounds(lng, lat));
      } else {
        coords.forEach((sub) => walkCoords(sub));
      }
    };

    features.forEach((f) => {
      if (!f?.geometry?.coordinates) return;
      walkCoords(f.geometry.coordinates);
    });

    if (!isFinite(minLng) || !isFinite(maxLng) || !isFinite(minLat) || !isFinite(maxLat)) {
      minLng = -2.2; maxLng = 0.8; minLat = 39.8; maxLat = 42.9;
    }

    // Calcular dimensiones manteniendo el aspect ratio correcto
    const lngRange = maxLng - minLng;
    const latRange = maxLat - minLat;
    // Correccion de Mercator para la latitud media de Aragon (~41.5)
    const latMid = (minLat + maxLat) / 2;
    const cosLat = Math.cos((latMid * Math.PI) / 180);
    const correctedLngRange = lngRange * cosLat;

    const baseSize = 450;
    let svgWidth, svgHeight;

    if (correctedLngRange > latRange) {
      svgWidth = baseSize;
      svgHeight = baseSize * (latRange / correctedLngRange);
    } else {
      svgHeight = baseSize;
      svgWidth = baseSize * (correctedLngRange / latRange);
    }

    return {
      features,
      bounds: { minLng, maxLng, minLat, maxLat, cosLat },
      svgWidth,
      svgHeight
    };
  }, [geoData]);

  const projectPoint = (lng, lat) => {
    const { minLng, maxLng, minLat, maxLat, cosLat } = bounds;
    // Aplicar correccion de Mercator para mantener proporciones
    const x = (((lng - minLng) * cosLat) / ((maxLng - minLng) * cosLat || 1)) * svgWidth;
    const y = svgHeight - ((lat - minLat) / (maxLat - minLat || 1)) * svgHeight;
    return [x, y];
  };

  const getFeaturePaths = (feature) => {
    const paths = [];
    const geom = feature.geometry || {};
    const { type, coordinates } = geom;

    if (!coordinates) return paths;

    const buildPath = (ring) => {
      if (!ring?.length) return '';
      const [firstLng, firstLat] = ring[0];
      const [startX, startY] = projectPoint(firstLng, firstLat);
      let d = `M ${startX},${startY}`;

      for (let i = 1; i < ring.length; i++) {
        const [lng, lat] = ring[i];
        const [x, y] = projectPoint(lng, lat);
        d += ` L ${x},${y}`;
      }
      return d + ' Z';
    };

    if (type === 'Polygon') {
      const mainPath = buildPath(coordinates[0]);
      if (mainPath) paths.push(mainPath);
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((poly) => {
        const mainPath = buildPath(poly[0]);
        if (mainPath) paths.push(mainPath);
      });
    }

    return paths;
  };

  const getMunicipioMeta = (feature) => {
    const props = feature.properties || {};
    const nombreMun = props.municipio_nombre || props.nombre_municipio || props.MUNICIPIO || props.municipio || '';
    const provincia = props.PROVINCIA || props.provincia || '';

    let fuerza1 = { nombre: '', porcentaje: '' };
    let fuerza2 = { nombre: '', porcentaje: '' };
    let fuerza3 = { nombre: '', porcentaje: '' };

    if (municipioInfo && nombreMun && provincia) {
      const key = makeMunicipioKey(nombreMun, provincia);
      const info = municipioInfo[key];
      if (info?.raw) {
        const raw = info.raw;
        fuerza1 = { nombre: raw.siglas_1 ?? '', porcentaje: raw.porcentaje_1 ?? '' };
        fuerza2 = { nombre: raw.siglas_2 ?? '', porcentaje: raw.porcentaje_2 ?? '' };
        fuerza3 = { nombre: raw.siglas_3 ?? '', porcentaje: raw.porcentaje_3 ?? '' };
      }
    }

    return { nombre_municipio: nombreMun, PROVINCIA: provincia, fuerza1, fuerza2, fuerza3 };
  };

  const getFillColor = (feature) => {
    const props = feature.properties || {};
    const nombreMun = props.municipio_nombre || props.nombre_municipio || props.MUNICIPIO || props.municipio || '';
    const provincia = props.PROVINCIA || props.provincia || '';

    if (municipioInfo && nombreMun && provincia) {
      const key = makeMunicipioKey(nombreMun, provincia);
      const info = municipioInfo[key];
      if (info?.siglas_1 && COLORS[info.siglas_1]) {
        return COLORS[info.siglas_1];
      }
    }

    const siglaGeo = props.siglas_1 || props.SIGLAS_1 || '';
    if (COLORS[siglaGeo]) return COLORS[siglaGeo];

    return DEFAULT_COLOR;
  };

  const handleMouseEnter = (e, feature) => {
    const meta = getMunicipioMeta(feature);
    setTooltipData(meta);
    updateTooltipPosition(e.clientX, e.clientY);
    setTooltipVisible(true);
  };

  const handleMouseMove = (e) => {
    updateTooltipPosition(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: CORPORATE_COLOR }}
          />
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{ border: `3px solid ${CORPORATE_COLOR}33`, borderTopColor: CORPORATE_COLOR }}
          />
          <div
            className="absolute inset-3 rounded-full animate-spin"
            style={{
              border: `2px solid ${CORPORATE_COLOR}22`,
              borderTopColor: CORPORATE_COLOR,
              animationDirection: 'reverse',
              animationDuration: '1.5s'
            }}
          />
        </div>
        <p className="text-slate-500 mt-6 text-sm">Cargando mapa electoral...</p>
      </div>
    );
  }

  if (!geoData || !features.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-slate-100"
        >
          <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-slate-700 font-semibold mb-2">Mapa no disponible</p>
        <p className="text-slate-500 text-sm max-w-xs">
          Agrega el archivo GeoJSON de Aragon en la carpeta public
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Leyenda */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {Object.entries(COLORS).slice(0, 6).map(([partido, color]) => (
          <div
            key={partido}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50"
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-medium text-slate-600">{partido}</span>
          </div>
        ))}
      </div>

      {/* Contenedor del mapa */}
      <div
        className="relative rounded-2xl p-6 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200"
      >

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-md mx-auto relative z-10"
          style={{ aspectRatio: `${svgWidth} / ${svgHeight}` }}
        >

          <g>
            {features.map((feature, index) => {
              const paths = getFeaturePaths(feature);
              const fill = getFillColor(feature);

              return (
                <g key={index}>
                  {paths.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill={fill}
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={0.5}
                      className="cursor-pointer transition-all duration-200 hover:brightness-110"
                      onMouseEnter={(e) => handleMouseEnter(e, feature)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Instruccion */}
        <p className="text-center text-slate-400 text-xs mt-4">
          Pasa el cursor sobre un municipio para ver los resultados
        </p>
      </div>

      {/* Tooltip flotante con animaciones fluidas */}
      <div
        ref={tooltipRef}
        className="fixed top-0 left-0 z-[9999] pointer-events-none"
        style={{
          opacity: tooltipVisible ? 1 : 0,
          transform: `translate3d(${positionRef.current.x + 20}px, ${positionRef.current.y - 10}px, 0)`,
          transition: 'opacity 0.15s ease-out',
          willChange: 'transform, opacity',
        }}
      >
        <div
          className="rounded-xl overflow-hidden bg-white border border-slate-200"
          style={{
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)',
            minWidth: '220px',
            transform: tooltipVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease-out',
          }}
        >
          {tooltipData && (
            <>
              {/* Header del tooltip */}
              <div
                className="px-4 py-3 border-b border-slate-100"
                style={{
                  background: `linear-gradient(135deg, ${CORPORATE_COLOR}15 0%, transparent 100%)`,
                }}
              >
                <p className="font-bold text-slate-800 text-sm">
                  {tooltipData.nombre_municipio || 'Municipio'}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">{tooltipData.PROVINCIA}</p>
              </div>

              {/* Contenido */}
              <div className="px-4 py-3 space-y-2.5">
                {tooltipData.fuerza1?.nombre ? (
                  <>
                    {/* Primera fuerza - destacada */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[tooltipData.fuerza1.nombre] || '#94a3b8',
                          }}
                        />
                        <span className="text-sm font-medium text-slate-700">{tooltipData.fuerza1.nombre}</span>
                      </div>
                      <span
                        className="text-sm font-black"
                        style={{ color: '#00d9a0' }}
                      >
                        {formatPct(tooltipData.fuerza1.porcentaje)}%
                      </span>
                    </div>

                    {/* Segunda fuerza */}
                    {tooltipData.fuerza2?.nombre && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: COLORS[tooltipData.fuerza2.nombre] || '#94a3b8' }}
                          />
                          <span className="text-xs text-slate-600">{tooltipData.fuerza2.nombre}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatPct(tooltipData.fuerza2.porcentaje)}%</span>
                      </div>
                    )}

                    {/* Tercera fuerza */}
                    {tooltipData.fuerza3?.nombre && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: COLORS[tooltipData.fuerza3.nombre] || '#94a3b8' }}
                          />
                          <span className="text-xs text-slate-500">{tooltipData.fuerza3.nombre}</span>
                        </div>
                        <span className="text-xs text-slate-400">{formatPct(tooltipData.fuerza3.porcentaje)}%</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400 text-xs text-center py-2">Sin datos disponibles</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapaAragon;
