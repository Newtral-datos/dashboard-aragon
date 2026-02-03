import React from 'react';

const Participacion = ({ participacionData }) => {
  // Normalizar texto para comparaciones
  const normalize = (str) =>
    String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Buscar datos
  const aragon = participacionData?.find(
    (d) => normalize(d.nombre_ambito) === 'aragon'
  );
  const zaragoza = participacionData?.find(
    (d) => normalize(d.nombre_ambito) === 'zaragoza'
  );
  const huesca = participacionData?.find(
    (d) => normalize(d.nombre_ambito) === 'huesca'
  );
  const teruel = participacionData?.find(
    (d) => normalize(d.nombre_ambito) === 'teruel'
  );

  const parseParticipacion = (p) => {
    if (!p) return 0;
    const str = String(p).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const formatNumber = (num) => {
    const n = Number(num);
    if (isNaN(n)) return '0';
    return n.toLocaleString('es-ES');
  };

  const formatPct = (num) => {
    return num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const data = [
    {
      nombre: 'Aragón',
      porcentaje: parseParticipacion(aragon?.participacion),
      porcentaje2023: 66.54,
      censo: aragon?.censo_total || 0,
      mesas: aragon?.mesas_totales || 0,
      isMain: true,
    },
    {
      nombre: 'Zaragoza',
      porcentaje: parseParticipacion(zaragoza?.participacion),
      porcentaje2023: 66.15,
      censo: zaragoza?.censo_total || 0,
      mesas: zaragoza?.mesas_totales || 0,
    },
    {
      nombre: 'Huesca',
      porcentaje: parseParticipacion(huesca?.participacion),
      porcentaje2023: 65.66,
      censo: huesca?.censo_total || 0,
      mesas: huesca?.mesas_totales || 0,
    },
    {
      nombre: 'Teruel',
      porcentaje: parseParticipacion(teruel?.participacion),
      porcentaje2023: 70.71,
      censo: teruel?.censo_total || 0,
      mesas: teruel?.mesas_totales || 0,
    },
  ];

  if (!participacionData || participacionData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-slate-200 rounded-full animate-spin mb-4" style={{ borderTopColor: '#01f3b3' }} />
        <p className="text-slate-500 text-sm">Cargando datos de participacion...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Participacion principal - Aragon y Provincias en grid horizontal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Aragon - Principal */}
        <div className="rounded-xl p-4 border" style={{ backgroundColor: 'rgba(1, 243, 179, 0.1)', borderColor: 'rgba(1, 243, 179, 0.3)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800">Aragón</h3>
            <p className="text-2xl font-black" style={{ color: '#01f3b3' }}>
              {formatPct(data[0].porcentaje)}%
            </p>
          </div>
          <div className="h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${data[0].porcentaje}%`, backgroundColor: '#01f3b3' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>Censo: {formatNumber(data[0].censo)}</span>
            <span>2023: {formatPct(data[0].porcentaje2023)}%</span>
          </div>
        </div>

        {/* Provincias */}
        {data.slice(1).map((item) => (
          <div
            key={item.nombre}
            className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">{item.nombre}</p>
              <p className="text-xl font-bold text-slate-800">{formatPct(item.porcentaje)}%</p>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${item.porcentaje}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Censo: {formatNumber(item.censo)}</span>
              <span>2023: {formatPct(item.porcentaje2023)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Participacion;
