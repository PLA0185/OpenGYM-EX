import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsx } from './readable-jsx-runtime.js'
it('protects native paragraph text across the app without changing its copied text',()=>{
  const markup=renderToStaticMarkup(jsx('p',{children:'力量与恢复。'}))
  expect(markup).toContain('class="text-unit"')
  expect(markup.replace(/<[^>]+>/g,'')).toBe('力量与恢复。')
})
it('leaves native option and source-code text intact',()=>{
  expect(renderToStaticMarkup(jsx('option',{children:'全身训练'}))).toBe('<option>全身训练</option>')
  expect(renderToStaticMarkup(jsx('pre',{children:'1kg × 3'}))).toBe('<pre>1kg × 3</pre>')
})
it('protects original recipe prose while preserving its literal line breaks and quantities',()=>{
  const markup=renderToStaticMarkup(jsx('pre',{className:'recipe-source-text',children:'原方力量与恢复。\n鸡肉 200g。'}))
  expect(markup).toContain('class="text-unit"');expect(markup.replace(/<[^>]+>/g,'')).toBe('原方力量与恢复。\n鸡肉 200g。')
})
