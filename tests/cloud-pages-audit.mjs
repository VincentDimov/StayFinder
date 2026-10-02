import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const site='https://stayfinder-tau-sepia.vercel.app',results=[],email='audit-page-'+randomUUID()+'@example.test';
let cookie,accountId;
function check(name,pass,detail){results.push({name,pass,...(detail?{detail}:{})});console.log((pass?'PASS ':'FAIL ')+name);}
async function html(path,cookie){const r=await fetch(site+path,{headers:cookie?{Cookie:cookie}:{},signal:AbortSignal.timeout(30000)});return {status:r.status,text:await r.text()};}
try{
const anon=await html('/properties');check('G3 anonymous navigation',anon.text.includes('Logga in')&&anon.text.includes('Skapa konto')&&!anon.text.includes('Logga ut'));
const props=await(await fetch(site+'/api/properties')).json();const detail=await html('/properties/'+props[0].id);check('G4 public list and detail',anon.status===200&&detail.status===200&&detail.text.includes(props[0].title));
check('G5 filter controls',['name="location"','name="max_price"','name="guests"'].every(x=>anon.text.includes(x)));
check('G8 sort controls',anon.text.includes('price_asc')&&anon.text.includes('price_desc'));
check('G9 anonymous login prompt',detail.text.includes('Logga in för att boka detta boende.'));
const missing=await html('/properties/00000000-0000-4000-8000-000000000000');check('G13 custom missing-property view',missing.text.includes('Den här platsen finns inte.'));
const reg=await fetch(site+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:site},body:JSON.stringify({name:'Audit Page',email,password:'AuditPassword2026!'})});check('G1 registration with production Origin',reg.status===201);const user=await reg.json();accountId=user.id;cookie=reg.headers.get('set-cookie')?.split(';')[0];
const logged=await html('/properties',cookie);check('G2/G3 server render after reload',logged.text.includes('Logga ut')&&logged.text.includes('Mina bokningar')&&logged.text.includes('Hej, '));
const form=await html('/properties/new',cookie);check('G7 authenticated property form',['name="title"','name="description"','name="price_per_night"','Publicera boende'].every(x=>form.text.includes(x)));
const booked=await html('/properties/'+props[0].id,cookie);check('G9/G11 authenticated booking form and price preview',['name="check_in"','name="check_out"','name="email"','price-summary','Boka din paus'].every(x=>booked.text.includes(x)));
const invalid=await fetch(site+'/api/properties',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:site},body:'{'});check('G14 malformed JSON status',invalid.status===400);
const hostile=await fetch(site+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://untrusted.example'}});check('G14 hostile Origin denied',hostile.status===403);
} catch(e){check('runner',false,e.message);} finally{if(cookie)await fetch(site+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie}}).catch(()=>{});await writeFile(new URL('../test-results/cloud-pages-audit.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),site,accountId,results},null,2)+'\n');console.log({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,accountId});process.exitCode=results.some(x=>!x.pass)?1:0;}
