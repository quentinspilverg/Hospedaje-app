import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISO(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function hoyISO() {
  const now = new Date()
  return toISO(now.getFullYear(), now.getMonth(), now.getDate())
}

export default function DateRangePicker({ habitacionId, entrada, salida, onChange, excludeReservaId }) {
  const [reservas, setReservas] = useState([])
  const [anchor, setAnchor] = useState(() => {
    const base = entrada ? new Date(entrada) : new Date()
    return { y: base.getFullYear(), m: base.getMonth() }
  })
  const [modo, setModo] = useState(entrada && salida ? 'entrada' : entrada ? 'salida' : 'entrada')

  useEffect(() => {
    if (!habitacionId) {
      setReservas([])
      return
    }
    let query = supabase
      .from('reservas')
      .select('fecha_entrada, fecha_salida')
      .eq('habitacion_id', habitacionId)

    if (excludeReservaId) query = query.neq('id', excludeReservaId)

    query.then(({ data }) => setReservas(data || []))
  }, [habitacionId, excludeReservaId])

  // Si ya hay una fecha de entrada elegida, hasta dónde puede llegar la salida
  const limiteSalida = useMemo(() => {
    if (!entrada) return null
    const futuras = reservas.map((r) => r.fecha_entrada).filter((f) => f > entrada).sort()
    return futuras.length > 0 ? futuras[0] : null
  }, [entrada, reservas])

  function estadoCelda(iso) {
    const checkin = reservas.some((r) => r.fecha_entrada === iso)
    const checkout = reservas.some((r) => r.fecha_salida === iso)
    const ocupada = reservas.some((r) => iso > r.fecha_entrada && iso < r.fecha_salida)

    if (modo === 'entrada') {
      if (ocupada || checkin) return { color: 'ocupada', disabled: true }
      if (checkout) return { color: 'checkout', disabled: false }
      return { color: 'disponible', disabled: false }
    }

    // modo salida
    if (!entrada || iso <= entrada) return { color: 'disponible', disabled: true }
    if (limiteSalida && iso > limiteSalida) return { color: 'ocupada', disabled: true }
    if (limiteSalida && iso === limiteSalida) return { color: 'checkin', disabled: false }
    return { color: 'disponible', disabled: false }
  }

  function diaDeshabilitado(iso) {
    return estadoCelda(iso).disabled
  }

  function handleClickDia(iso) {
    if (diaDeshabilitado(iso)) return

    if (modo === 'entrada') {
      onChange({ entrada: iso, salida: '' })
      setModo('salida')
    } else {
      onChange({ entrada, salida: iso })
      setModo('entrada')
    }
  }

  function reiniciar() {
    onChange({ entrada: '', salida: '' })
    setModo('entrada')
  }

  function cambiarMes(delta) {
    const d = new Date(anchor.y, anchor.m + delta, 1)
    setAnchor({ y: d.getFullYear(), m: d.getMonth() })
  }

  const diasDelMes = new Date(anchor.y, anchor.m + 1, 0).getDate()
  const primerDiaSemana = (new Date(anchor.y, anchor.m, 1).getDay() + 6) % 7 // 0 = lunes
  const celdas = []
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasDelMes; d++) celdas.push(d)

  return (
    <div className="date-picker">
      <div className="date-picker-status">
        {!habitacionId && <span className="date-picker-hint">Elige una habitación primero</span>}
        {habitacionId && (
          <>
            <button
              type="button"
              className={'date-picker-chip' + (modo === 'entrada' ? ' active' : '')}
              onClick={() => setModo('entrada')}
            >
              Entrada: {entrada || '—'}
            </button>
            <button
              type="button"
              className={'date-picker-chip' + (modo === 'salida' ? ' active' : '')}
              onClick={() => entrada && setModo('salida')}
              disabled={!entrada}
            >
              Salida: {salida || '—'}
            </button>
            {(entrada || salida) && (
              <button type="button" className="date-picker-reset" onClick={reiniciar}>
                Reiniciar
              </button>
            )}
          </>
        )}
      </div>

      {habitacionId && (
        <div className="date-picker-calendar">
          <div className="calendar-nav" style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => cambiarMes(-1)}>‹</button>
            <span className="calendar-label">{MESES[anchor.m]} {anchor.y}</span>
            <button type="button" onClick={() => cambiarMes(1)}>›</button>
          </div>

          <div className="date-picker-grid">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="date-picker-dow">{d}</div>
            ))}
            {celdas.map((d, i) => {
              if (d === null) return <div key={`vacio-${i}`} />
              const iso = toISO(anchor.y, anchor.m, d)
              const estado = estadoCelda(iso)
              const esEntrada = iso === entrada
              const esSalida = iso === salida
              const enRango = entrada && salida && iso > entrada && iso < salida
              let clase = 'date-picker-day'
              if (estado.disabled) clase += ' disabled'
              if (esEntrada || esSalida) clase += ' selected'
              if (enRango) clase += ' in-range'
              if (iso === hoyISO()) clase += ' today'
              const colorVar =
                estado.color === 'ocupada'
                  ? 'var(--cal-ocupada)'
                  : estado.color === 'checkin'
                  ? 'var(--cal-checkin)'
                  : estado.color === 'checkout'
                  ? 'var(--cal-checkout)'
                  : 'var(--color-bg)'
              return (
                <button
                  type="button"
                  key={iso}
                  className={clase}
                  style={{ '--cal-color': colorVar }}
                  disabled={estado.disabled}
                  onClick={() => handleClickDia(iso)}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <p className="date-picker-legend">
            🔴 Ocupado &nbsp; 🟡 Check-in ese día &nbsp; 🔵 Check-out ese día (disponible para entrar)
          </p>
        </div>
      )}
    </div>
  )
}
