import { supabase } from '../supabaseClient'

function pad(n) {
  return String(n).padStart(2, '0')
}

export async function generarGastosFijosDelMes(hospedajeId) {
  if (!hospedajeId) return

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const diasEnMes = new Date(year, month + 1, 0).getDate()

  const inicioMes = `${year}-${pad(month + 1)}-01`
  const finMes = `${year}-${pad(month + 1)}-${pad(diasEnMes)}`

  const { data: configs, error: errConfigs } = await supabase
    .from('gastos_fijos_config')
    .select('*')
    .eq('activo', true)
    .eq('hospedaje_id', hospedajeId)

  if (errConfigs || !configs || configs.length === 0) return

  const { data: existentes, error: errExistentes } = await supabase
    .from('gastos')
    .select('config_id')
    .eq('tipo', 'fijo')
    .eq('hospedaje_id', hospedajeId)
    .gte('fecha', inicioMes)
    .lte('fecha', finMes)

  if (errExistentes) return

  const yaCreados = new Set((existentes || []).map((e) => e.config_id))
  const faltantes = configs.filter((c) => !yaCreados.has(c.id))

  if (faltantes.length === 0) return

  const nuevos = faltantes.map((c) => ({
    hospedaje_id: hospedajeId,
    fecha: `${year}-${pad(month + 1)}-${pad(Math.min(c.dia_vencimiento, diasEnMes))}`,
    categoria: c.categoria,
    tipo: 'fijo',
    descripcion: c.descripcion,
    monto: c.monto,
    estado: 'pendiente',
    config_id: c.id,
  }))

  await supabase.from('gastos').insert(nuevos)
}
