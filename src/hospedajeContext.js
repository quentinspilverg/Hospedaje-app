import { createContext, useContext } from 'react'

export const HospedajeContext = createContext(null)

export function useHospedaje() {
  return useContext(HospedajeContext)
}
