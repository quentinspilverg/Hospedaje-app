import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { generarGastosFijosDelMes } from './utils/gastosFijos'
import { HospedajeContext } from './hospedajeContext'
import Login from './pages/Login'
import Reservas from './pages/Reservas'
import Calendario from './pages/Calendario'
import Gastos from './pages/Gastos'
import Resumen from './pages/Resumen'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hospedaje, setHospedaje] = useState(null)
  const [loadingHospedaje, setLoadingHospedaje] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setHospedaje(null)
      return
    }

    async function cargarHospedaje() {
      setLoadingHospedaje(true)
      const { data } = await supabase
        .from('usuarios_hospedaje')
        .select('hospedaje_id, rol, hospedajes(id, nombre)')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (data) {
        setHospedaje({ id: data.hospedaje_id, nombre: data.hospedajes?.nombre, rol: data.rol })
        await generarGastosFijosDelMes(data.hospedaje_id)
      }
      setLoadingHospedaje(false)
    }

    cargarHospedaje()
  }, [session])

  if (checkingSession) {
    return <p className="center-msg">Cargando...</p>
  }

  if (!session) {
    return <Login />
  }

  if (loadingHospedaje) {
    return <p className="center-msg">Cargando tu hospedaje...</p>
  }

  if (!hospedaje) {
    return <p className="center-msg">Tu usuario no está vinculado a ningún hospedaje. Contacta al administrador.</p>
  }

  return (
    <HospedajeContext.Provider value={hospedaje}>
      <div className="app-shell">
        <button className="logout-btn" onClick={() => supabase.auth.signOut()}>
          Salir
        </button>
        <Routes>
          <Route path="/" element={<Gastos />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/reservas" element={<Reservas />} />
          <Route path="/resumen" element={<Resumen />} />
        </Routes>
        <Nav />
      </div>
    </HospedajeContext.Provider>
  )
}
