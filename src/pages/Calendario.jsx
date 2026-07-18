import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import ReservaForm from '../components/ReservaForm'

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISO(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function todayParts() {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
}

function buildMonthDays(y, m) {
  const total = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => ({ y, m, d: i + 1, iso: toISO(y, m, i + 1) }))
}

function buildWeekDays(y, m, d) {
  const base = new Date(y, m, d)
  const dow = (base.getDay() + 6) % 7 // 0 = lunes
  const monday = new Date(y, m, d - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), iso: toISO(dt.getFullYear(), dt.getMonth(), dt.getDate()) }
  })
}

function primeraPalabra(nombre) {
  return nombre.split(' ')[0]
}

export default function Calendario() {
  const [viewMode, setViewMode] = useState('mensual') // 'mensual' | 'semanal'
  const [roomFilter, setRoomFilter] = useState('todas')
  const [anchor, setAnchor] = useState(todayParts())
  const [habitaciones, setHabitaciones] = useState([])
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [initialForm, setInitialForm] = useState(null)

  const today = todayParts()
  const todayISO = toISO(today.y, today.m, today.d)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: hab }, { data: res }] = await Promise.all([
      supabase.from('habitaciones').select('*').order('codigo'),
      supabase.from('reservas').select('*, habitaciones(nombre, codigo), clientes(nombre)'),
    ])
    setHabitaciones(hab || [])
    setReservas(res || [])
    setLoading(false)
  }

  const days = useMemo(() => {
    return viewMode === 'mensual'
      ? buildMonthDays(anchor.y, anchor.m)
      : buildWeekDays(anchor.y, anchor.m, anchor.d)
  }, [viewMode, anchor])

  const roomsToShow = useMemo(() => {
    if (roomFilter === 'todas') return habitaciones
    return habitaciones.filter((h) => h.id === roomFilter)
  }, [habitaciones, roomFilter])

  // Prioridad visual: traspaso (checkout+checkin mismo día) > check-in > check-out > ocupada > disponible
  function estadoDia(habitacionId, iso) {
    const checkin = reservas.find((r) => r.habitacion_id === habitacionId && r.fecha_entrada === iso)
    const checkout = reservas.find((r) => r.habitacion_id === habitacionId && r.fecha_salida === iso)

    if (checkin && checkout) return { estado: 'turnover', reserva: checkin, reservaCheckout: checkout }
    if (checkin) return { estado: 'checkin', reserva: checkin }
    if (checkout) return { estado: 'checkout', reserva: checkout }

    const ocupada = reservas.find(
      (r) => r.habitacion_id === habitacionId && iso > r.fecha_entrada && iso < r.fecha_salida
    )
    if (ocupada) return { estado: 'ocupada', reserva: ocupada }

    return { estado: 'disponible', reserva: null }
  }

  function goPrev() {
    const d = new Date(anchor.y, anchor.m, anchor.d)
    if (viewMode === 'mensual') d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 7)
    setAnchor({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() })
  }

  function goNext() {
    const d = new Date(anchor.y, anchor.m, anchor.d)
    if (viewMode === 'mensual') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 7)
    setAnchor({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() })
  }

  function goToday() {
    setAnchor(todayParts())
  }

  function handleCellClick(habitacionId, iso, info) {
    if (info.reserva) {
      setEditing(info.reserva)
      setInitialForm(null)
    } else {
      setEditing(null)
      setInitialForm({ habitacion_id: habitacionId, fecha_entrada: iso })
    }
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    setInitialForm(null)
    loadAll()
  }

  const label =
    viewMode === 'mensual'
      ? `${MESES[anchor.m]} ${anchor.y}`
      : `${days[0].d} ${MESES[days[0].m].slice(0, 3)} - ${days[6].d} ${MESES[days[6].m].slice(0, 3)}`

  return (
    <div className="page page-wide">
      <h1 className="page-title">Calendario</h1>
      <p className="page-subtitle">Toca un espacio libre para crear una reserva, u ocupado para editarla</p>

      <div className="calendar-controls">
        <div className="toggle-group">
          <button className={viewMode === 'mensual' ? 'active' : ''} onClick={() => setViewMode('mensual')}>
            Mensual
          </button>
          <button className={viewMode === 'semanal' ? 'active' : ''} onClick={() => setViewMode('semanal')}>
            Semanal
          </button>
        </div>

        <select className="status-select" style={{ width: 'auto' }} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="todas">Todas las habitaciones</option>
          {habitaciones.map((h) => (
            <option key={h.id} value={h.id}>
              {h.nombre}
            </option>
          ))}
        </select>

        <div className="calendar-nav">
          <button onClick={goPrev}>‹</button>
          <span className="calendar-label">{label}</span>
          <button onClick={goNext}>›</button>
        </div>
        <button className="btn-secondary" onClick={goToday}>
          Hoy
        </button>
      </div>

      {loading ? (
        <p className="center-msg">Cargando...</p>
      ) : (
        <div className="calendar-scroll">
          <div
            className="calendar-grid"
            style={{ gridTemplateColumns: `128px repeat(${days.length}, 42px)` }}
          >
            <div className="cal-corner" />
            {days.map((day) => (
              <div key={day.iso} className={'cal-header-cell' + (day.iso === todayISO ? ' cal-today' : '')}>
                {viewMode === 'semanal' && <div>{DIAS_SEMANA[(new Date(day.y, day.m, day.d).getDay() + 6) % 7]}</div>}
                <div>{day.d}</div>
              </div>
            ))}

            {roomsToShow.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                days={days}
                todayISO={todayISO}
                estadoDia={estadoDia}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      )}

      <div className="calendar-legend">
        <span><span className="status-dot" style={{ background: 'var(--cal-disponible)' }} /> Disponible</span>
        <span><span className="status-dot" style={{ background: 'var(--cal-ocupada)' }} /> Ocupada</span>
        <span><span className="status-dot" style={{ background: 'var(--cal-checkin)' }} /> Check-in</span>
        <span><span className="status-dot" style={{ background: 'var(--cal-checkout)' }} /> Check-out (hasta 12:30)</span>
      </div>

      {showForm && (
        <ReservaForm
          habitaciones={habitaciones}
          reserva={editing}
          initial={initialForm}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function colorDeEstado(estado) {
  if (estado === 'checkin') return 'var(--cal-checkin)'
  if (estado === 'checkout') return 'var(--cal-checkout)'
  if (estado === 'ocupada') return 'var(--cal-ocupada)'
  return 'var(--cal-disponible)'
}

function RoomRow({ room, days, todayISO, estadoDia, onCellClick }) {
  return (
    <>
      <div className="cal-room-label" title={room.nombre}>
        <span className="cal-room-line">
          🚪 {primeraPalabra(room.nombre)} · {room.codigo}
        </span>
        <span className="cal-room-cap">👥 {room.capacidad}</span>
      </div>
      {days.map((day) => {
        const info = estadoDia(room.id, day.iso)
        const style = { '--cal-color': colorDeEstado(info.estado) }
        if (info.estado === 'turnover') {
          style.background = 'linear-gradient(135deg, var(--cal-checkout) 50%, var(--cal-checkin) 50%)'
        }
        return (
          <div
            key={day.iso}
            className={'cal-cell' + (day.iso === todayISO ? ' cal-today' : '')}
            style={style}
            title={
              info.estado === 'turnover'
                ? `Sale: ${info.reservaCheckout.clientes?.nombre} · Llega: ${info.reserva.clientes?.nombre}`
                : info.reserva
                ? info.reserva.clientes?.nombre
                : 'Disponible'
            }
            onClick={() => onCellClick(room.id, day.iso, info)}
          />
        )
      })}
    </>
  )
}
