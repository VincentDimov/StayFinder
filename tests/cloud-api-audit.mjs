import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const base = (process.env.API_BASE ?? 'https://stayfinder-tau-sepia.vercel.app/api').replace(/\/$/, '');
const prefix = 'audit-' + randomUUID();
const results = [], accounts = [], properties = [], bookings = new Map();
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function call(path, method='GET', body, cookie='stayfinder_session=invalid') {
  const r = await fetch(base + path, {method, headers: {'Content-Type':'application/json', Cookie:cookie}, ...(body !== undefined ? {body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(30000)});
  const data = r.status === 204 ? null : await r.json();
  return {status:r.status, data, cookie:r.headers.get('set-cookie')?.split(';')[0], cookieFlags:r.headers.get('set-cookie')?.replace(/stayfinder_session=[^;]+/, 'stayfinder_session=[REDACTED]')};
}
function check(name, actual, expected, detail) { const pass = JSON.stringify(actual) === JSON.stringify(expected); results.push({name, pass, actual, expected, ...(detail ? {detail}: {})}); console.log((pass?'PASS ':'FAIL ')+name); }
async function status(name,path,method,body,cookie,expected){ const r=await call(path,method,body,cookie); check(name,r.status,expected,r.status>=400?r.data:undefined); return r; }
try {
  await status('G14 health','/health','GET',undefined,undefined,200);
  for (const name of ['Host','Guest','Other']) {
    const email=prefix+'-'+name.toLowerCase()+'@example.test';
    const r=await status('G1 register '+name,'/auth/register','POST',{name,email,password:'AuditPassword2026!'},undefined,201);
    if(r.status!==201)throw new Error('Registration failed');
    accounts.push({id:r.data.id,email,cookie:r.cookie,name});
    check('G2 secure persistent cookie '+name, /HttpOnly/i.test(r.cookieFlags)&&/Secure/i.test(r.cookieFlags)&&/Max-Age=604800/i.test(r.cookieFlags),true);
  }
  const [h,g,o]=accounts;
  const me=await call('/auth/me','GET',undefined,g.cookie); check('G2 persistent session identity',me.data.user?.id,g.id);
  await status('G1 wrong password','/auth/login','POST',{email:g.email,password:'WrongPassword2026!'},undefined,401);
  const login=await status('G1 login','/auth/login','POST',{email:g.email,password:'AuditPassword2026!'},undefined,200);
  await status('G1 logout','/auth/logout','POST',undefined,login.cookie,204);
  check('G1 revoked session',(await call('/auth/me','GET',undefined,login.cookie)).data.user,null);
  const pd={title:'Audit house',description:'Isolated accommodation for requirement verification.',location:prefix,price_per_night:1000,max_guests:4};
  await status('G6 anonymous create','/properties','POST',pd,undefined,401);
  for(const price of [1000,1500]){const r=await status('G7 create property '+price,'/properties','POST',{...pd,price_per_night:price},h.cookie,201); if(r.status!==201)throw new Error('Property creation failed');properties.push(r.data.id);}
  const p=properties[0];
  await status('G4 public detail','/properties/'+p,'GET',undefined,undefined,200);
  await status('G14 missing property','/properties/'+randomUUID(),'GET',undefined,undefined,404);
  for(const method of ['PUT','DELETE']){await status('G6 anonymous '+method,'/properties/'+p,method,method==='PUT'?pd:undefined,undefined,401);await status('VG1 non-owner '+method,'/properties/'+p,method,method==='PUT'?pd:undefined,g.cookie,404);}
  for(const sort of ['price_asc','price_desc']){const r=await call('/properties?location='+prefix+'&sort='+sort);check('G8 '+sort,r.data.map(x=>x.price_per_night),sort==='price_asc'?[1000,1500]:[1500,1000]);}
  check('G5 combined filters',(await call('/properties?location='+prefix+'&max_price=1200&guests=3')).data.map(x=>x.id),[p]);
  check('G5 capacity filter',(await call('/properties?location='+prefix+'&guests=5')).data.length,0);
  const valid={email:g.email,guests:2,check_in:day(30),check_out:day(33)};
  await status('G9 anonymous booking','/properties/'+p+'/bookings','POST',valid,undefined,401);
  for(const [name,patch] of [['email',{email:'bad'}],['zero guests',{guests:0}],['reversed dates',{check_in:valid.check_out,check_out:valid.check_in}],['invalid calendar date',{check_in:'2027-02-30'}],['VG3 capacity',{guests:5}],['VG5 past date',{check_in:day(-1),check_out:day(1)}]])await status('G10 '+name,'/properties/'+p+'/bookings','POST',{...valid,...patch},g.cookie,400);
  async function book(name,data,actor=g,expected=201){const r= expected===null ? await call('/properties/'+p+'/bookings','POST',data,actor.cookie) : await status(name,'/properties/'+p+'/bookings','POST',data,actor.cookie,expected);if(r.status===201)bookings.set(r.data.id,actor.cookie);return r;}
  const r=await book('G9 create booking / VG6 tampering',{...valid,total_price:1,user_id:h.id,status:'confirmed'});if(r.status!==201)throw new Error('Booking creation failed');const b=r.data;
  check('VG6 calculated total',b.total_price,3000);check('VG1 owner from session',b.user_id,g.id);check('VG4 initial pending',b.status,'pending');
  check('VG1 other guest sees none',(await call('/bookings','GET',undefined,o.cookie)).data.length,0);
  check('G12 host sees property bookings',(await call('/bookings?property_id='+p,'GET',undefined,h.cookie)).data.map(x=>x.id),[b.id]);
  await status('VG1 other guest cannot edit','/bookings/'+b.id,'PUT',valid,o.cookie,404);
  await status('VG1 other guest cannot delete','/bookings/'+b.id,'DELETE',undefined,o.cookie,404);
  const conflict=await book('VG2 overlap create',{...valid,check_in:day(31),check_out:day(34)},o,409);check('VG2 explicit conflict code',conflict.data.code,'BOOKING_CONFLICT');
  await status('VG2 own booking excluded / G12 edit','/bookings/'+b.id,'PUT',{...valid,guests:3},g.cookie,200);
  const adj=await book('VG2 adjacent dates',{...valid,check_in:day(33),check_out:day(35)},o);
  await status('VG2 overlap update','/bookings/'+adj.data.id,'PUT',{...valid,check_in:day(32),check_out:day(35)},o.cookie,409);
  const race=await Promise.all([g,o].map(a=>book('VG2 concurrent '+a.name,{...valid,email:a.email,check_in:day(70),check_out:day(72)},a,null)));
  // Individuella samtidiga resultat varierar; kombinationen måste vara 201/409.
  check('VG2 concurrent result',race.map(x=>x.status).sort(),[201,409]);
  await status('VG3 capacity reduction','/properties/'+p,'PUT',{...pd,max_guests:2},h.cookie,400);
  await status('VG6 property price update','/properties/'+p,'PUT',{...pd,price_per_night:2000},h.cookie,200);
  check('VG6 stored price unchanged',(await call('/bookings','GET',undefined,g.cookie)).data.find(x=>x.id===b.id).total_price,3000);
  const changed=await status('VG6 date update preserves original rate','/bookings/'+b.id,'PUT',{...valid,check_out:day(32)},g.cookie,200);check('VG6 original nightly rate',changed.data.total_price,2000);
  await status('G12 restore dates','/bookings/'+b.id,'PUT',valid,g.cookie,200);
  const search='/properties?location='+prefix+'&max_price=2500&guests=2&sort=price_desc&check_in='+day(31)+'&check_out='+day(32);
  check('VG7 filtered availability',(await call(search)).data.map(x=>x.id),[properties[1]]);
  for(const query of ['?check_in='+day(30),'?check_in='+day(31)+'&check_out='+day(30),'?check_in=2027-02-30&check_out=2027-03-03'])await status('VG7 invalid period '+query,'/properties'+query,'GET',undefined,undefined,400);
  await status('VG4 guest cannot confirm','/bookings/'+b.id+'/status','PATCH',{status:'confirmed'},g.cookie,403);
  await status('VG4 host cannot change guest data','/bookings/'+b.id,'PUT',{...valid,guests:1},h.cookie,403);
  await status('VG4 host confirms','/bookings/'+b.id+'/status','PATCH',{status:'confirmed'},h.cookie,200);
  await status('VG4 confirmed cannot return pending','/bookings/'+b.id+'/status','PATCH',{status:'pending'},h.cookie,400);
  await status('VG4 guest cancels','/bookings/'+b.id+'/status','PATCH',{status:'cancelled'},g.cookie,200);
  await status('VG4 cancelled immutable','/bookings/'+b.id,'PUT',valid,g.cookie,400);
  await status('VG4 cancelled cannot reactivate','/bookings/'+b.id+'/status','PATCH',{status:'confirmed'},h.cookie,400);
  const replacement=await book('VG2 cancelled no longer blocks',valid,o);
  await status('VG4 host cancels pending','/bookings/'+replacement.data.id+'/status','PATCH',{status:'cancelled'},h.cookie,200);
} catch(error) {results.push({name:'runner',pass:false,detail:error.message}); console.error(error.message);} finally {
  for(const [id,cookie] of bookings){await status('cleanup booking '+id,'/bookings/'+id,'DELETE',undefined,cookie,204).catch(e=>results.push({name:'cleanup',pass:false,detail:e.message}));}
  for(const id of properties){await status('cleanup property '+id,'/properties/'+id,'DELETE',undefined,accounts[0].cookie,204).catch(e=>results.push({name:'cleanup',pass:false,detail:e.message}));}
  for(const a of accounts)await call('/auth/logout','POST',undefined,a.cookie).catch(()=>{});
  const report={date:new Date().toISOString(),base,prefix,accountIds:accounts.map(a=>a.id),results};
  await writeFile(new URL('../test-results/cloud-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,accountIds:report.accountIds}));
  process.exitCode=results.some(r=>!r.pass)?1:0;
}
