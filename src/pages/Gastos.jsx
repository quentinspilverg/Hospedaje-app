import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import GastoForm from '../components/GastoForm'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const ICONOS = {
  arriendo: '🏠',
  agua: '💧',
  luz: '💡',
  gas: '🔥',
  internet: '🌐',
  celular: '📱',
  universidad: '🎓',
  contribuciones: '🏛️',
  insumos_aseo: '🧹',
  insumos_alimentarios: '🍽️',
  mantencion: '🔧',
  otro: '📦',
}

const LABELS = {
  insumos_aseo: 'Insumos de aseo',
  insumos_alimentarios: 'Insumos alimentarios',
  mantencion: 'Mantención',
  otro: 'Otro',
}

function categoriaLabel(c) {
  return LABELS[c] || c.replace('_', ' ')
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function fechaISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Calcula el mensaje y color según cuántos días faltan (o pasaron) para la fecha del gasto
function estadoPago(fechaISOStr, estado) {
  if (estado === 'pagado') {
    return { texto: '✅ Pagado', clase: 'badge-verde' }
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [y, m, d] = fechaISOStr.split('-').map(Number)
  const fechaVenc = new Date(y, m - 1, d)

  const diffDias = Math.round((fechaVenc - hoy) / 86400000)

  if (diffDias > 1) {
    return { texto: `🟠 ${diffDias} días para pagar`, clase: 'badge-naranjo' }
  }
  if (diffDias === 1) {
    const diaSemana = DIAS_SEMANA[fechaVenc.getDay()]
    return { texto: `🟠 Debes pagar mañana ${diaSemana}`, clase: 'badge-naranjo' }
  }
  if (diffDias === 0) {
    return { texto: '🔴 Pagar hoy', clase: 'badge-rojo' }
  }
  const diasVencido = Math.abs(diffDias)
  return {
    texto: `🔴 Debiste pagar hace ${diasVencido} día${diasVencido === 1 ? '' : 's'}`,
    clase: 'badge-rojo',
  }
}

const INICIO_PROYECTO = { y: 2026, m: 6 } // Julio 2026

function monthKey(y, m) {
  return y * 12 + m
}

export default function Gastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const now = new Date()
  const [periodo, setPeriodo] = useState('mensual') // mensual | semanal | 14 | 30
  const [anchorMes, setAnchorMes] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [anchorSemana, setAnchorSemana] = useState(now)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('gastos').select('*').order('fecha', { ascending: false })
    if (error) setError('No se pudieron cargar los gastos.')
    else setGastos(data)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(g) {
    setEditing(g)
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    load()
  }

  async function handleDelete(g) {
    if (!confirm(`¿Estás seguro de eliminar "${categoriaLabel(g.categoria)}" ($${Number(g.monto).toLocaleString('es-CL', { maximumFractionDigits: 0 })})?`)) return
    const { error } = await supabase.from('gastos').delete().eq('id', g.id)
    if (error) setError('No se pudo eliminar.')
    else load()
  }

  const rango = useMemo(() => {
    if (periodo === 'mensual') {
      const { y, m } = anchorMes
      const dias = new Date(y, m + 1, 0).getDate()
      return [`${y}-${pad(m + 1)}-01`, `${y}-${pad(m + 1)}-${pad(dias)}`]
    }
    if (periodo === 'semanal') {
      const dow = (anchorSemana.getDay() + 6) % 7
      const monday = new Date(anchorSemana)
      monday.setDate(anchorSemana.getDate() - dow)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return [fechaISO(monday), fechaISO(sunday)]
    }
    const dias = periodo === '14' ? 14 : 30
    const fin = new Date()
    const inicio = new Date()
    inicio.setDate(fin.getDate() - (dias - 1))
    return [fechaISO(inicio), fechaISO(fin)]
  }, [periodo, anchorMes, anchorSemana])

  const gastosFiltrados = gastos.filter((g) => g.fecha >= rango[0] && g.fecha <= rango[1])

  const puedeRetroceder = monthKey(anchorMes.y, anchorMes.m) > monthKey(INICIO_PROYECTO.y, INICIO_PROYECTO.m)
  const maxMes = new Date(now.getFullYear(), now.getMonth() + 6, 1)
  const puedeAvanzar = monthKey(anchorMes.y, anchorMes.m) < monthKey(maxMes.getFullYear(), maxMes.getMonth())

  function cambiarMes(delta) {
    const d = new Date(anchorMes.y, anchorMes.m + delta, 1)
    setAnchorMes({ y: d.getFullYear(), m: d.getMonth() })
  }

  function cambiarSemana(delta) {
    const d = new Date(anchorSemana)
    d.setDate(d.getDate() + delta * 7)
    setAnchorSemana(d)
  }

  function irAHoy() {
    setAnchorMes({ y: now.getFullYear(), m: now.getMonth() })
    setAnchorSemana(now)
  }

  return (
    <div className="page">
      <h1 className="page-title">Gastos</h1>
      <p className="page-subtitle">Gastos fijos y variables del hospedaje</p>

      <div className="period-controls">
        <div className="toggle-group">
          <button className={periodo === 'mensual' ? 'active' : ''} onClick={() => setPeriodo('mensual')}>Mensual</button>
          <button className={periodo === 'semanal' ? 'active' : ''} onClick={() => setPeriodo('semanal')}>Semanal</button>
          <button className={periodo === '14' ? 'active' : ''} onClick={() => setPeriodo('14')}>14 días</button>
          <button className={periodo === '30' ? 'active' : ''} onClick={() => setPeriodo('30')}>30 días</button>
        </div>
      </div>

      {periodo === 'mensual' && (
        <div className="calendar-nav" style={{ marginBottom: 16 }}>
          <button onClick={() => cambiarMes(-1)} disabled={!puedeRetroceder}>‹</button>
          <span className="calendar-label">{MESES[anchorMes.m]} {anchorMes.y}</span>
          <button onClick={() => cambiarMes(1)} disabled={!puedeAvanzar}>›</button>
          <button className="btn-secondary" onClick={irAHoy}>Hoy</button>
        </div>
      )}

      {periodo === 'semanal' && (
        <div className="calendar-nav" style={{ marginBottom: 16 }}>
          <button onClick={() => cambiarSemana(-1)}>‹</button>
          <span className="calendar-label">Semana del {fechaISO(anchorSemana)}</span>
          <button onClick={() => cambiarSemana(1)}>›</button>
          <button className="btn-secondary" onClick={irAHoy}>Hoy</button>
        </div>
      )}

      {loading && <p className="center-msg">Cargando...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && gastosFiltrados.length === 0 && (
        <p className="center-msg">No hay gastos en este período.</p>
      )}

      <div className="reserva-list">
        {gastosFiltrados.map((g) => {
          const estado = estadoPago(g.fecha, g.estado)
          return (
            <div key={g.id} className="reserva-item">
              <div className="reserva-info" onClick={() => openEdit(g)}>
                <div className="reserva-top">
                  <span className="reserva-huesped">{ICONOS[g.categoria] || '📦'} {categoriaLabel(g.categoria)}</span>
                  <span className="reserva-precio">${Number(g.monto).toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="reserva-meta">
                  {g.fecha} · {g.tipo} {g.proveedor ? `· ${g.proveedor}` : ''}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => openEdit(g)} aria-label="Editar">✏️</button>
                <button className="icon-btn danger" onClick={() => handleDelete(g)} aria-label="Eliminar">🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      <button className="fab" onClick={openNew} aria-label="Nuevo gasto">
        +
      </button>

      {showForm && <GastoForm gasto={editing} onClose={() => setShowForm(false)} onSaved={handleSaved} />}
    </div>
  )
}
