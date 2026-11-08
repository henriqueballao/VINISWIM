import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ViniOriginalLayout from './ViniOriginalLayout'
import './styles.css'

const params=new URLSearchParams(window.location.search)
const useLive=params.get('live')==='1'||params.has('invite')||params.has('reset')||window.location.hash.includes('access_token')||window.location.hash.includes('type=recovery')
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{useLive?<App/>:<ViniOriginalLayout/>}</React.StrictMode>)

// The installed iOS PWA must update in place. Never require the user to delete
// the Home Screen app just to receive a new frontend build.
if('serviceWorker'in navigator){
 window.addEventListener('load',async()=>{
  try{
   const reg=await navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{updateViaCache:'none'})
   await reg.update()
   let reloading=false
   navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading)return
    reloading=true
    window.location.reload()
   })
  }catch{}
 })
}
