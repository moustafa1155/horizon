import {MongoClient} from 'mongodb';
export async function employeeCollection(){
 if(!process.env.MONGODB_URI)throw new Error('Database configuration missing');
 const uri=process.env.MONGODB_URI;
 if(!globalThis.employeeMongoPromise){const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});globalThis.employeeMongoPromise=client.connect().catch(e=>{delete globalThis.employeeMongoPromise;throw e});}
 const client=await globalThis.employeeMongoPromise;
 const name=process.env.MONGODB_DATABASE||process.env.MONGODB_DB_NAME||new URL(uri).pathname.slice(1).split('/')[0]||'taste_the_best';
 return client.db(name).collection('employees');
}
