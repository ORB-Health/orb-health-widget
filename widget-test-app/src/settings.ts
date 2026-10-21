import { createContext, useContext } from 'react'

/** Whether a field typed as `null` is sent as JSON null. Set from the Configuration section. */
export const SendNullLiteralContext = createContext(false)

export const useSendNullLiteral = () => useContext(SendNullLiteralContext)
