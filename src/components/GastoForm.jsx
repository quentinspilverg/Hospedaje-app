import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useHospedaje } from '../hospedajeContext'

const CATEGORIAS = {
  fijo: ['arriendo', 'agua', 'luz', 'gas', 'internet', 'celular', 'universidad', 'contribuciones'],
  variable: ['insumos_aseo', 'insumos_alimentarios', 'mantencion', 'otro'],
}

const LABELS = {
  insumos_aseo: 'Insumos de aseo',
  insumos_alimentarios: 'Insumos alimentarios',
  mantencion: 'Mantención',
  otro: 'Otro',
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm() {
  return {
    fecha: hoyISO(),
    tipo: 'variable',
    categoria: CATEGORIAS.variable[0],
    descripcion: '',
    monto: '',
    proveedor: '',
    estado: 'pagado',
  }
}

export default function GastoForm({ gasto, onClose, onSaved }) {
  const hospedaje = useHospedaje()
  const isEditing = Boolean(gasto)
  const [form, setForm] = useState(
    gasto
      ? {
          fecha: gasto.fecha,
          tipo: gasto.tipo,
          categoria: gasto.categoria,
          descripcion: gasto.descripcion || '',
          monto: gasto.monto,
          proveedor: gasto.proveedor || '',
          estado: gasto.estado,
        }
      : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'tipo') {
        next.categoria = CATEGORIAS[value][0]
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      hospedaje_id: hospedaje.id,
      fecha: form.fecha,
      tipo: form.tipo,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      monto: Number(form.monto),
      proveedor: form.proveedor || null,
      estado: form.estado,
    }

    const { error } = isEditing
      ? await supabase.from('gastos').update(payload).eq('id', gasto.id)
      : await supabase.from('gastos').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message || 'Ocurrió un error al guardar.')
    } else {
      onSaved()
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este gasto?')) return
    setSaving(true)
    const { error } = await supabase.from('gastos').delete().eq('id', gasto.id)
    setSaving(false)
    if (error) setError('No se pudo eliminar.')
    else onSaved()
  }

  const categoriaLabel = (c) => LABELS[c] || c.replace('_', ' ')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} required />
          </div>

          <div className="field">
            <label>Monto ($)</label>
            <input type="number" min="0" value={form.monto} onChange={(e) => update('monto', e.target.value)} required />
          </div>

          <div className="field">
            <label>Descripción {isEditing ? '' : '(opcional)'}</label>
            <input value={form.descripcion} onChange={(e) => update('descripcion', e.target.value)} />
          </div>

          {!isEditing && (
            <div className="field">
              <label>Tipo de gasto</label>
              <select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}>
                {CATEGORIAS.variable.map((c) => (
                  <option key={c} value={c}>
                    {categoriaLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEditing && (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={(e) => update('tipo', e.target.value)}>
                    <option value="fijo">Fijo</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
                <div className="field">
                  <label>Categoría</label>
                  <select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}>
                    {(CATEGORIAS[form.tipo] || []).map((c) => (
                      <option key={c} value={c}>
                        {categoriaLabel(c)}
                      </option>
                    ))}
                    {!CATEGORIAS[form.tipo]?.includes(form.categoria) && (
                      <option value={form.categoria}>{categoriaLabel(form.categoria)}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Proveedor (opcional)</label>
                <input value={form.proveedor} onChange={(e) => update('proveedor', e.target.value)} />
              </div>

              <div className="field">
                <label>Estado</label>
                <select value={form.estado} onChange={(e) => update('estado', e.target.value)}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            </>
          )}

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
              Eliminar gasto
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
