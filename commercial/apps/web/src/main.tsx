import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)

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
