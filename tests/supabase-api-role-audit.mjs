import dotenv from 'dotenv';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
dotenv.config({path:new URL('../.env',import.meta.url),quiet:true});
const cloud=JSON.parse(await readFile(new URL('../test-results/cloud-audit.json',import.meta.url),'utf8'));
const [host,guest,other]=cloud.accountIds;
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_CA?{ca:process.env.DATABASE_CA.replace(/\\n/g,'\n'),rejectUnauthorized:true}:undefined,connectionTimeoutMillis:10000});
const results=[];
function check(name,actual,expected){const pass=JSON.stringify(actual)===JSON.stringify(expected);results.push({name,pass,actual,expected});console.log((pass?'PASS ':'FAIL ')+name);}
async function rejects(name,sql,values,codes){await client.query('SAVEPOINT expected_failure');let code=null;try{await client.query(sql,values);}catch(e){code=e.code;}finally{await client.query('ROLLBACK TO SAVEPOINT expected_failure');await client.query('RELEASE SAVEPOINT expected_failure');}check(name,codes.includes(code),true);}
async function actor(id){await client.query("SELECT set_config('app.user_id',$1,true)",[id??'']);}
const p=randomUUID(),b=randomUUID(),adj=randomUUID();
const insert='INSERT INTO public.bookings(id,property_id,user_id,email,guests,check_in,check_out,total_price) VALUES($1,$2,$3,$4,$5,CURRENT_DATE+$6::integer,CURRENT_DATE+$7::integer,1) RETURNING *';
try {
await client.connect();await client.query('BEGIN');
const role=(await client.query('SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
check('G15 restricted runtime role',role.name==='stayfinder_api'&&!role.rolsuper&&!role.rolbypassrls,true);
await actor(host);await client.query('INSERT INTO public.properties(id,owner_id,title,description,location,price_per_night,max_guests) VALUES($1,$2,$3,$4,$5,1000,4)',[p,host,'Audit SQL house','Transactional database verification fixture.','Audit SQL']);
await actor(null);check('G6 anonymous update',(await client.query('UPDATE public.properties SET price_per_night=1 WHERE id=$1',[p])).rowCount,0);
await rejects('G6 anonymous insert','INSERT INTO public.properties(owner_id,title,description,location,price_per_night,max_guests) VALUES($1,$2,$3,$4,1000,4)',[host,'Audit SQL house','Transactional verification fixture.','Audit'],['42501']);
await actor(guest);check('VG1 other owner update',(await client.query('UPDATE public.properties SET price_per_night=1 WHERE id=$1',[p])).rowCount,0);check('VG1 other owner delete',(await client.query('DELETE FROM public.properties WHERE id=$1',[p])).rowCount,0);
await rejects('VG1 forged booking owner',insert,[randomUUID(),p,host,'guest@example.test',2,40,42],['42501']);
const booking=(await client.query(insert,[b,p,guest,'guest@example.test',2,30,33])).rows[0];check('VG6 insert overrides price',Number(booking.total_price),3000);
await client.query('UPDATE public.bookings SET total_price=1 WHERE id=$1',[b]);check('VG6 update overrides price',Number((await client.query('SELECT total_price FROM public.bookings WHERE id=$1',[b])).rows[0].total_price),3000);
await client.query('UPDATE public.bookings SET guests=3 WHERE id=$1',[b]);check('VG2 self ignored',(await client.query('SELECT guests FROM public.bookings WHERE id=$1',[b])).rows[0].guests,3);
await rejects('VG1 cannot change booking user','UPDATE public.bookings SET user_id=$2 WHERE id=$1',[b,other],['42501']);
await rejects('VG4 guest confirmation',"UPDATE public.bookings SET status='confirmed' WHERE id=$1",[b],['42501']);
await rejects('VG3 capacity','UPDATE public.bookings SET guests=5 WHERE id=$1',[b],['P0001']);
await rejects('G10 email',insert,[randomUUID(),p,guest,'invalid',1,40,41],['23514']);
await rejects('G10 zero guests',insert,[randomUUID(),p,guest,'guest@example.test',0,40,41],['23514']);
await rejects('G10 reversed dates',insert,[randomUUID(),p,guest,'guest@example.test',1,41,40],['23514','22000']);
await rejects('VG5 past date',insert,[randomUUID(),p,guest,'guest@example.test',1,-2,1],['P0001']);
await rejects('VG2 overlap insert',insert,[randomUUID(),p,guest,'guest@example.test',1,31,34],['23P01']);
await client.query(insert,[adj,p,guest,'guest@example.test',1,33,35]);check('VG2 adjacent date accepted',true,true);
await rejects('VG2 overlap update','UPDATE public.bookings SET check_in=CURRENT_DATE+32 WHERE id=$1',[adj],['23P01']);
await actor(other);check('VG1 booking invisible',(await client.query('SELECT * FROM public.bookings WHERE id=$1',[b])).rowCount,0);check('VG1 booking cannot update',(await client.query('UPDATE public.bookings SET guests=1 WHERE id=$1',[b])).rowCount,0);
check('VG7 hidden bookings affect availability',(await client.query('SELECT private.is_available($1,CURRENT_DATE+31,CURRENT_DATE+32) AS available',[p])).rows[0].available,false);
await rejects('VG7 invalid period','SELECT private.is_available($1,CURRENT_DATE+32,CURRENT_DATE+31)',[p],['P0001']);
await rejects('G15 private accounts inaccessible','SELECT * FROM private.users',[],['42501']);
await actor(host);check('VG1 host reads bookings',(await client.query('SELECT * FROM public.bookings WHERE property_id=$1',[p])).rowCount,2);
await rejects('VG3 unsafe capacity decrease','UPDATE public.properties SET max_guests=2 WHERE id=$1',[p],['P0001']);
await client.query('UPDATE public.properties SET price_per_night=2000 WHERE id=$1',[p]);check('VG6 existing price remains',Number((await client.query('SELECT total_price FROM public.bookings WHERE id=$1',[b])).rows[0].total_price),3000);
await client.query("UPDATE public.bookings SET status='confirmed' WHERE id=$1",[b]);check('VG4 host confirms',(await client.query('SELECT status FROM public.bookings WHERE id=$1',[b])).rows[0].status,'confirmed');
await actor(guest);await client.query('UPDATE public.bookings SET check_out=CURRENT_DATE+32 WHERE id=$1',[b]);check('VG6 original nightly rate preserved',Number((await client.query('SELECT total_price FROM public.bookings WHERE id=$1',[b])).rows[0].total_price),2000);
await client.query("UPDATE public.bookings SET status='cancelled' WHERE id=$1",[b]);
await rejects('VG4 cancelled immutable','UPDATE public.bookings SET guests=1 WHERE id=$1',[b],['P0001']);
await rejects('VG4 cancelled cannot reactivate',"UPDATE public.bookings SET status='pending' WHERE id=$1",[b],['P0001']);
check('VG2 cancelled frees dates',(await client.query('SELECT private.is_available($1,CURRENT_DATE+31,CURRENT_DATE+32) AS available',[p])).rows[0].available,true);
} catch(e){results.push({name:'runner',pass:false,detail:e.message});console.error(e.message);} finally{
await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});
await writeFile(new URL('../test-results/supabase-audit.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),rollback:true,results},null,2)+'\n');console.log(JSON.stringify({passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length}));process.exitCode=results.some(x=>!x.pass)?1:0;
}
