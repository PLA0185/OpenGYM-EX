import { createDeepSeek } from '../src/lib/deepseek.js'
if(!process.argv.includes('--live') || !process.env.DEEPSEEK_API_KEY){
  console.log('SKIP: requires --live and a user-provided DEEPSEEK_API_KEY in this process environment. No other credential files are read.')
}else{
  const provider=createDeepSeek({credential:async()=>process.env.DEEPSEEK_API_KEY,model:process.env.DEEPSEEK_MODEL||'deepseek-flash'})
  try{await provider.healthCheck();console.log('PASS: live provider connection')}catch(e){console.error('FAIL:',e.code);process.exitCode=1}
}
