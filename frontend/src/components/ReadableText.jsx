import { readableUnits } from '../lib/readable-text.js'
export default function ReadableText({children}){
  if(typeof children!=='string'&&typeof children!=='number')return children
  return readableUnits(children).map((text,i)=><span className="text-unit" key={i}>{text}</span>)
}
