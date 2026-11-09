import { createOpeningRecorder } from './app-openings.js';
import { verifyDeviceAccess } from './device-access.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, runTransaction, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
const firebaseConfig = {
    apiKey: "AIzaSyAaa4Rs4vk2xq0PzXnb9tdLnt1oqqj4qa4",
    authDomain: "boxplaytv-b32d8.firebaseapp.com",
    databaseURL: "https://boxplaytv-b32d8-default-rtdb.firebaseio.com",
    projectId: "boxplaytv-b32d8",
    storageBucket: "boxplaytv-b32d8.firebasestorage.app",
    messagingSenderId: "165114643998",
    appId: "1:165114643998:web:d12cb70574ac11f29a100f"
  };
const db=getFirestore(initializeApp(firebaseConfig));
const recordOpening=createOpeningRecorder({db,doc,setDoc});
const get=k=>{try{return localStorage.getItem(k)||'';}catch(_){return '';}};
const put=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
let device=get('boxplay_device_id');
if(!device){device='dev-'+(crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''));put('boxplay_device_id',device);}
let email='',until=0,checked=0,checking=null;
async function verify(address){
 const target=String(address||'').trim().toLowerCase();
 if(!target)return {activo:false,razon:'no_existe'};
 const result=await verifyDeviceAccess({db,doc,runTransaction},target,device);
 if(result.activo){email=target;until=new Date(result.expiresAt).getTime();checked=Date.now();put('boxplay_user_email',target);presence();}
 else{until=0;checked=0;}
 return result;
}
async function presence(){if(!email||Date.now()>=until||document.hidden)return;recordOpening(email,device).catch(error=>console.warn('No se pudo registrar la apertura; se reintentará:',error));try{await setDoc(doc(db,'presencia',encodeURIComponent(email)+'__'+device),{email,deviceId:device,lastSeenMs:Date.now(),estado:'online'},{merge:true});}catch(_){}}
async function valid(){const address=email||get('boxplay_user_email');if(!address)return false;if(Date.now()<until&&Date.now()-checked<60000)return true;if(!checking)checking=verify(address).finally(()=>{checking=null;});return (await checking).activo;}
window.boxTVAuth={verify,valid};
setInterval(async()=>{if(!email||document.hidden||!until)return;try{if(!await valid())window.dispatchEvent(new Event('box-auth-expired'));else presence();}catch(_){/* A temporary network outage is checked again at the next interval. */}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)presence();});

// Validate a remembered subscriber on launch, even before starting playback.
valid().catch(error=>console.warn('No se pudo validar el acceso al abrir Smart TV:',error));
