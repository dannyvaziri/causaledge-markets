export const START=100,TARGET=1000;
export function money(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v||0))}
export function pct(v){const n=Number(v||0);return`${n>=0?'+':''}${n.toFixed(2)}%`}
export function shortTime(v){try{return v?new Date(v).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}catch{return'—'}}
export function typeLabel(t){return({geopolitical:'GEO',hazard:'HAZARD',seismic:'SEISMIC',news:'NEWS'})[t]||String(t||'INTEL').toUpperCase()}
export function haversine(a,b){const r=6371,rad=v=>v*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return r*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
