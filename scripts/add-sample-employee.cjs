const {loadEnvConfig}=require('@next/env');
const {MongoClient}=require('mongodb');
loadEnvConfig(process.cwd(),false,{info(){},error(){}});
async function main(){
 const uri=process.env.MONGODB_URI;
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});
 try{
  await client.connect();
  const name=process.env.MONGODB_DATABASE||process.env.MONGODB_DB_NAME||new URL(uri).pathname.slice(1).split('/')[0]||'taste_the_best';
  const collection=client.db(name).collection('employees');
  const sample={fullName:'Sample Employee (Demo)',phoneNumber:'07700 900123',nationalInsuranceNumber:'DEMO-NOT-REAL',email:'sample.employee@example.com',isSample:true,createdAt:new Date(),updatedAt:new Date()};
  const result=await collection.updateOne({email:sample.email},{$setOnInsert:sample},{upsert:true});
  const saved=await collection.findOne({email:sample.email},{projection:{_id:0,fullName:1,phoneNumber:1,nationalInsuranceNumber:1,email:1,isSample:1}});
  console.log(result.upsertedCount?'Added one fictional employee.':'Sample employee already exists; no duplicate added.');
  console.log(JSON.stringify(saved));
 }finally{await client.close();}
}
main().catch(()=>{console.error('Sample employee could not be added. Credentials were not printed.');process.exitCode=1;});