import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import ReservaForm from '../components/ReservaForm'

function formatFecha(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

export default function Reservas() {
  const [reservas, setReservas] = useState([])
  const [habitaciones, setHabitaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError('')

    const [{ data: hab, error: habErr }, { data: res, error: resErr }] = await Promise.all([
      supabase.from('habitaciones').select('*').order('codigo'),
      supabase
        .from('reservas')
        .select('*, habitaciones(nombre, codigo), clientes(nombre)')
        .order('fecha_entrada', { ascending: false }),
    ])

    if (habErr || resErr) {
      setError('No se pudieron cargar los datos.')
    } else {
      setHabitaciones(hab)
      setReservas(res)
    }
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(reserva) {
    setEditing(reserva)
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    loadAll()
  }

  async function handleDelete(r) {
    if (!confirm(`¿Estás seguro de eliminar la reserva de "${r.clientes?.nombre}"?`)) return
    const { error } = await supabase.from('reservas').delete().eq('id', r.id)
    if (error) setError('No se pudo eliminar.')
    else loadAll()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Todas tus reservas, más recientes primero</p>
        </div>
      </div>

      {loading && <p className="center-msg">Cargando...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && reservas.length === 0 && (
        <p className="center-msg">Aún no hay reservas. Crea la primera con el botón +.</p>
      )}

      <div className="reserva-list">
        {reservas.map((r) => {
          const saldo = Number(r.precio_total) - Number(r.monto_abonado || 0)
          return (
            <div key={r.id} className="reserva-item">
              <div className="reserva-info" onClick={() => openEdit(r)}>
                <div className="reserva-top">
                  <span className="reserva-huesped">👤 {r.clientes?.nombre}</span>
                  <span className="reserva-precio">${fmt(r.precio_total)}</span>
                </div>
                <div className="reserva-meta">
                  🚪 {r.habitaciones?.nombre} · {formatFecha(r.fecha_entrada)} - {formatFecha(r.fecha_salida)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="badge">{r.metodo_pago === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}</span>{' '}
                  <span className="badge">{saldo > 0 ? `Saldo $${fmt(saldo)}` : '✅ Pagado completo'}</span>
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => openEdit(r)} aria-label="Editar">✏️</button>
                <button className="icon-btn danger" onClick={() => handleDelete(r)} aria-label="Eliminar">🗑️</button>
              </div>
            </div>
          )
        })}
      </div>

      <button className="fab" onClick={openNew} aria-label="Nueva reserva">
        +
      </button>

      {showForm && (
        <ReservaForm
          habitaciones={habitaciones}
          reserva={editing}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
