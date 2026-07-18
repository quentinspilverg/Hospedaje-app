import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useHospedaje } from '../hospedajeContext'
import DateRangePicker from './DateRangePicker'

function emptyForm(habitaciones) {
  return {
    huesped: '',
    habitacion_id: habitaciones[0]?.id || '',
    fecha_entrada: '',
    fecha_salida: '',
    precio_total: '',
    monto_abonado: '',
    metodo_pago: 'transferencia',
  }
}

export default function ReservaForm({ habitaciones, reserva, initial, onClose, onSaved }) {
  const hospedaje = useHospedaje()
  const isEditing = Boolean(reserva)
  const [form, setForm] = useState(
    reserva
      ? {
          huesped: reserva.clientes?.nombre || '',
          habitacion_id: reserva.habitacion_id,
          fecha_entrada: reserva.fecha_entrada,
          fecha_salida: reserva.fecha_salida,
          precio_total: reserva.precio_total,
          monto_abonado: reserva.monto_abonado,
          metodo_pago: reserva.metodo_pago || 'transferencia',
        }
      : { ...emptyForm(habitaciones), ...initial }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function resolveClienteId() {
    const nombre = form.huesped.trim()
    const { data: existentes } = await supabase.from('clientes').select('id').eq('nombre', nombre).limit(1)

    if (existentes && existentes.length > 0) return existentes[0].id

    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({ nombre, hospedaje_id: hospedaje.id })
      .select('id')
      .single()
    if (error) throw error
    return nuevo.id
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.fecha_entrada || !form.fecha_salida) {
      setError('Elige la fecha de entrada y salida en el calendario.')
      return
    }

    if (new Date(form.fecha_salida) <= new Date(form.fecha_entrada)) {
      setError('La fecha de salida debe ser posterior a la de entrada.')
      return
    }

    setSaving(true)
    try {
      let query = supabase
        .from('reservas')
        .select('id')
        .eq('habitacion_id', form.habitacion_id)
        .lt('fecha_entrada', form.fecha_salida)
        .gt('fecha_salida', form.fecha_entrada)

      if (isEditing) {
        query = query.neq('id', reserva.id)
      }

      const { data: conflictos, error: errConflictos } = await query
      if (errConflictos) throw errConflictos

      if (conflictos && conflictos.length > 0) {
        setError('Esa habitación ya está reservada en esas fechas.')
        setSaving(false)
        return
      }

      const cliente_id = isEditing ? reserva.cliente_id : await resolveClienteId()

      const payload = {
        cliente_id,
        hospedaje_id: hospedaje.id,
        habitacion_id: form.habitacion_id,
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        precio_total: Number(form.precio_total),
        monto_abonado: Number(form.monto_abonado || 0),
        metodo_pago: form.metodo_pago,
      }

      const { error } = isEditing
        ? await supabase.from('reservas').update(payload).eq('id', reserva.id)
        : await supabase.from('reservas').insert(payload)

      if (error) throw error
      onSaved()
    } catch (err) {
      setError(err.message || 'Ocurrió un error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta reserva?')) return
    setSaving(true)
    const { error } = await supabase.from('reservas').delete().eq('id', reserva.id)
    setSaving(false)
    if (error) setError('No se pudo eliminar.')
    else onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? 'Editar reserva' : 'Nueva reserva'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Huésped</label>
            <input value={form.huesped} onChange={(e) => update('huesped', e.target.value)} required disabled={isEditing} />
          </div>

          <div className="field">
            <label>Habitación</label>
            <select value={form.habitacion_id} onChange={(e) => update('habitacion_id', e.target.value)}>
              {habitaciones.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre} ({h.codigo})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Fechas</label>
            <DateRangePicker
              habitacionId={form.habitacion_id}
              entrada={form.fecha_entrada}
              salida={form.fecha_salida}
              excludeReservaId={isEditing ? reserva.id : null}
              onChange={({ entrada, salida }) => {
                update('fecha_entrada', entrada)
                update('fecha_salida', salida)
              }}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Valor total estadía ($)</label>
              <input type="number" min="0" value={form.precio_total} onChange={(e) => update('precio_total', e.target.value)} required />
            </div>
            <div className="field">
              <label>Monto abonado ($)</label>
              <input type="number" min="0" value={form.monto_abonado} onChange={(e) => update('monto_abonado', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Tipo de pago</label>
            <select value={form.metodo_pago} onChange={(e) => update('metodo_pago', e.target.value)}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {isEditing && (
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={saving}>
              Eliminar reserva
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
