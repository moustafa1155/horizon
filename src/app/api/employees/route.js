import {ObjectId} from 'mongodb';
import {employeeCollection} from 'lib/mongodb';
export const runtime='nodejs';export const dynamic='force-dynamic';
function denied(request){
 const url=new URL(request.url);const host=(request.headers.get('host')||'').split(':')[0];
 if(process.env.NODE_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(host))return Response.json({error:'Database employee access requires server authentication outside local development.'},{status:403});
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return Response.json({error:'Invalid request origin.'},{status:403});
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Invalid request origin.'},{status:403});
}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export async function GET(request){const rejection=denied(request);if(rejection)return rejection;try{const collection=await employeeCollection();const records=await collection.find({},{projection:{fullName:1,phoneNumber:1,nationalInsuranceNumber:1,email:1,isSample:1,branchId:1}}).sort({fullName:1}).limit(1000).toArray();return json({employees:records.map(({_id,...record})=>({...record,id:_id.toString()}))});}catch{return json({error:'Employees could not be loaded from the database.'},503)}}
export async function POST(request){return saveEmployee(request,false)}
export async function PUT(request){return saveEmployee(request,true)}
async function saveEmployee(request,editing){const rejection=denied(request);if(rejection)return rejection;try{
 if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Expected employee details as JSON.'},400);
 const body=await request.json();if(editing&&(!/^[a-f0-9]{24}$/i.test(body.id||'')))return json({error:'Invalid employee identifier.'},400);const limits={fullName:150,phoneNumber:40,nationalInsuranceNumber:20,email:254};const record={};for(const [key,max] of Object.entries(limits)){if(typeof body[key]!=='string'||!body[key].trim()||body[key].trim().length>max)return json({error:'Enter valid details for all four fields.'},400);record[key]=body[key].trim();}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))return json({error:'Enter a valid email address.'},400);
 record.email=record.email.toLowerCase();record.nationalInsuranceNumber=record.nationalInsuranceNumber.replace(/\s/g,'').toUpperCase();
 if(body.branchId!==undefined){if(typeof body.branchId!=='string'||body.branchId.length>120)return json({error:'Invalid branch assignment.'},400);record.branchId=body.branchId;}
 const collection=await employeeCollection();const now=new Date();if(editing){const result=await collection.updateOne({_id:new ObjectId(body.id)},{$set:{...record,updatedAt:now}});if(!result.matchedCount)return json({error:'Employee no longer exists.'},404);return json({employee:{...record,id:body.id}});}const result=await collection.insertOne({...record,createdAt:now,updatedAt:now});return json({employee:{...record,id:result.insertedId.toString()}},201);
 }catch(error){return json({error:error.code===11000?'An employee with this email or National Insurance number already exists.':'The employee could not be saved. Please try again.'},error.code===11000?409:503)}}
