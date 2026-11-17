/* Private offline packs: IndexedDB only, scoped to a previously signed-in account. */
window.PrivateStudyCache=(()=>{
  function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('learn-skit-private',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function use(mode,operation){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('packs',mode),request=operation(tx.objectStore('packs'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{database.close();resolve(result);};tx.onerror=()=>{database.close();reject(tx.error);};});}
  return{read:id=>use('readonly',store=>store.get(id)),save:(id,modules)=>use('readwrite',store=>store.put({saved_at:Date.now(),modules},id)),remove:id=>use('readwrite',store=>store.delete(id))};
})();
