import { jsxDEV as reactJSXDev } from 'react/jsx-dev-runtime'
import { propsFor } from './readable-jsx-runtime.js'
export { Fragment } from 'react/jsx-dev-runtime'
export const jsxDEV=(type,props,...rest)=>reactJSXDev(type,propsFor(type,props),...rest)
