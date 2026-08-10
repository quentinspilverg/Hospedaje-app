import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

// Noches de una reserva que caen dentro de un mes dado (year, monthIndex)
function nochesEnMes(reserva, year, monthIndex) {
  const inicioMes = new Date(year, monthIndex, 1)
  const finMes = new Date(year, monthIndex + 1, 1)
  const entrada = new Date(reserva.fecha_entrada)
  const salida = new Date(reserva.fecha_salida)

  const desde = entrada > inicioMes ? entrada : inicioMes
  const hasta = salida < finMes ? salida : finMes

  const noches = Math.round((hasta - desde) / (1000 * 60 * 60 * 24))
  return Math.max(noches, 0)
}

export default function Resumen() {
  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() }
  })
  const [reservas, setReservas] = useState([])
  const [gastos, setGastos] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: res }, { data: gas }, { data: hab }] = await Promise.all([
      supabase.from('reservas').select('*, habitaciones(nombre, codigo)'),
      supabase.from('gastos').select('*'),
      supabase.from('habitaciones').select('*').order('codigo'),
    ])
    setReservas(res || [])
    setGastos(gas || [])
    setHabitaciones(hab || [])
    setLoading(false)
  }

  const diasDelMes = new Date(anchor.y, anchor.m + 1, 0).getDate()

  const resumen = useMemo(() => {
    const nochesPorReserva = reservas.map((r) => ({ r, noches: nochesEnMes(r, anchor.y, anchor.m) }))
      .filter((x) => x.noches > 0)

    const ingresos = nochesPorReserva.reduce((sum, { r, noches }) => {
      const totalNoches = Math.round((new Date(r.fecha_salida) - new Date(r.fecha_entrada)) / 86400000)
      const precioPorNoche = totalNoches > 0 ? r.precio_total / totalNoches : 0
      return sum + precioPorNoche * noches
    }, 0)

    const nochesVendidas = nochesPorReserva.reduce((sum, { noches }) => sum + noches, 0)

    const gastosMes = gastos.filter((g) => {
      const f = new Date(g.fecha)
      return f.getFullYear() === anchor.y && f.getMonth() === anchor.m
    })
    const totalGastos = gastosMes.reduce((sum, g) => sum + Number(g.monto), 0)

    const capacidadNoches = habitaciones.length * diasDelMes
    const ocupacion = capacidadNoches > 0 ? (nochesVendidas / capacidadNoches) * 100 : 0
    const precioPromedio = nochesVendidas > 0 ? ingresos / nochesVendidas : 0

    const porHabitacion = habitaciones.map((h) => {
      const propias = nochesPorReserva.filter(({ r }) => r.habitacion_id === h.id)
      const nochesHab = propias.reduce((s, { noches }) => s + noches, 0)
      const ingresosHab = propias.reduce((sum, { r, noches }) => {
        const totalNoches = Math.round((new Date(r.fecha_salida) - new Date(r.fecha_entrada)) / 86400000)
        const precioPorNoche = totalNoches > 0 ? r.precio_total / totalNoches : 0
        return sum + precioPorNoche * noches
      }, 0)
      const reservasHab = new Set(propias.map(({ r }) => r.id)).size
      const ocupacionHab = diasDelMes > 0 ? (nochesHab / diasDelMes) * 100 : 0
      return { habitacion: h, ingresos: ingresosHab, ocupacion: ocupacionHab, reservas: reservasHab }
    })

    return {
      ingresos,
      totalGastos,
      ganancia: ingresos - totalGastos,
      ocupacion,
      nochesVendidas,
      precioPromedio,
      porHabitacion,
    }
  }, [reservas, gastos, habitaciones, anchor, diasDelMes])

  function cambiarMes(delta) {
    const d = new Date(anchor.y, anchor.m + delta, 1)
    setAnchor({ y: d.getFullYear(), m: d.getMonth() })
  }

  if (loading) {
    return (
      <div className="page">
        <p className="center-msg">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Resumen</h1>
      <div className="calendar-nav" style={{ marginBottom: 18 }}>
        <button onClick={() => cambiarMes(-1)}>‹</button>
        <span className="calendar-label">
          {MESES[anchor.m]} {anchor.y}
        </span>
        <button onClick={() => cambiarMes(1)}>›</button>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Ingresos" value={`$${fmt(resumen.ingresos)}`} />
        <KpiCard label="Gastos" value={`$${fmt(resumen.totalGastos)}`} />
        <KpiCard label="Ganancia estimada" value={`$${fmt(resumen.ganancia)}`} highlight={resumen.ganancia >= 0} />
        <KpiCard label="Ocupación" value={`${resumen.ocupacion.toFixed(0)}%`} />
        <KpiCard label="Noches vendidas" value={resumen.nochesVendidas} />
        <KpiCard label="Precio promedio/noche" value={`$${fmt(resumen.precioPromedio)}`} />
      </div>

      <h2 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', margin: '22px 0 10px' }}>Por habitación</h2>
      <div className="reserva-list">
        {resumen.porHabitacion
          .sort((a, b) => b.ingresos - a.ingresos)
          .map(({ habitacion, ingresos, ocupacion, reservas }) => (
            <div key={habitacion.id} className="reserva-item" style={{ cursor: 'default' }}>
              <div className="reserva-top">
                <span className="reserva-huesped">{habitacion.nombre}</span>
                <span className="reserva-precio">${fmt(ingresos)}</span>
              </div>
              <div className="reserva-meta">
                {ocupacion.toFixed(0)}% ocupación · {reservas} reserva{reservas === 1 ? '' : 's'}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function KpiCard({ label, value, highlight }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value" style={highlight === false ? { color: 'var(--status-mantenimiento)' } : undefined}>
        {value}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}
