const {loadEnvConfig}=require('@next/env');
const {MongoClient}=require('mongodb');
loadEnvConfig(process.cwd(),false,{info(){},error(){}});
async function main(){
 const uri=process.env.MONGODB_URI;
 if(!uri)throw new Error('MONGODB_URI is missing.');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});
 try{
 await client.connect();
 const uriDatabase=new URL(uri).pathname.slice(1).split('/')[0];
 const databaseName=process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || uriDatabase || 'taste_the_best';
 const db=client.db(databaseName);
 const validator={$jsonSchema:{bsonType:'object',required:['fullName','phoneNumber','nationalInsuranceNumber','email'],properties:{fullName:{bsonType:'string',minLength:1,maxLength:150},phoneNumber:{bsonType:'string',minLength:1,maxLength:40},nationalInsuranceNumber:{bsonType:'string',minLength:1,maxLength:20},email:{bsonType:'string',pattern:'^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',maxLength:254},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'}}}};
 const exists=await db.listCollections({name:'employees'}).hasNext();
 if(exists){console.log('Employees collection already exists; existing data and validation were preserved.');}
 else{await db.createCollection('employees',{validator,validationLevel:'strict',validationAction:'error'});await db.collection('employees').createIndex({email:1},{name:'employee_email',unique:true,collation:{locale:'en',strength:2}});await db.collection('employees').createIndex({nationalInsuranceNumber:1},{name:'employee_national_insurance_number',unique:true});console.log('Created employees collection with required fields and unique email/National Insurance indexes. No employee records were added.');}
 console.log('Database: '+databaseName);
 console.log('Collection verified: '+await db.listCollections({name:'employees'}).hasNext());
 }finally{await client.close();}
}
main().catch(error=>{console.error('Employee collection setup failed ('+(error.codeName||error.name||'connection error')+'). Credentials were not printed.');process.exitCode=1;});
