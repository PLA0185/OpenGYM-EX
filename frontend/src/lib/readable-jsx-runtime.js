import { jsx as reactJSX, jsxs as reactJSXs } from 'react/jsx-runtime'
import { readableUnits } from './readable-text.js'
export { Fragment } from 'react/jsx-runtime'
const raw=new Set(['option','textarea','script','style','pre','code','text','tspan','title'])
function textChildren(children,preserveNewlines=false){
  if(Array.isArray(children)){
    // Merge adjacent string/number expressions so e.g. 1 + " g" stays together.
    const parts=[];for(const child of children){if((typeof child==='string'||typeof child==='number')&&typeof parts.at(-1)==='string')parts[parts.length-1]+=child;else parts.push(typeof child==='number'?String(child):child)}
    return parts.map((child,i)=>typeof child==='string'?reactJSX('span',{className:'text-run',children:units(child,preserveNewlines)},'run-'+i):child)
  }
  return typeof children==='string'||typeof children==='number'?units(String(children),preserveNewlines):children
}
function units(text,preserveNewlines=false){return text.split('\n').flatMap((line,i)=>[...(i?[preserveNewlines?'\n':reactJSX('br',{},'break-'+i)]:[]),...readableUnits(line).map((part,j)=>reactJSX('span',{className:'text-unit',children:part},i+'-'+j))])}
function propsFor(type,props){
  const prose=type==='pre'&&/recipe-source-text|recipe-quantities/.test(props?.className||'')
  if(typeof type!=='string'||(raw.has(type)&&!prose)||props?.contentEditable||props?.className?.includes('text-unit')||props?.children==null)return props
  return {...props,children:textChildren(props.children,prose)}
}
export const jsx=(type,props,key)=>reactJSX(type,propsFor(type,props),key)
export const jsxs=(type,props,key)=>reactJSXs(type,propsFor(type,props),key)
export { propsFor }
