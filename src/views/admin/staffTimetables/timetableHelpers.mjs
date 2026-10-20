export const SHIFT_STORAGE_KEY='horizon.staff-shifts.v1';
export function validateShifts(rows){
 if(!Array.isArray(rows))return 'Invalid timetable.';
 const minutes=v=>v.split(':').reduce((sum,n,i)=>sum+Number(n)*(i?1:60),0);
 for(const row of rows){if(!row||!Number.isInteger(Number(row.day))||Number(row.day)<0||Number(row.day)>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end))return 'Choose a day and valid times for every shift.';const duration=minutes(row.end)-minutes(row.start);if(duration<=0||String(row.breakMinutes).trim()===''||!Number.isInteger(Number(row.breakMinutes))||Number(row.breakMinutes)<0||Number(row.breakMinutes)>=duration)return 'End time must follow start time and breaks must be shorter than the shift.';}
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(Number(rows[i].day)===Number(rows[j].day)&&rows[i].start<rows[j].end&&rows[i].end>rows[j].start)return 'Two shifts overlap on the same day.';
 return '';
}
export function loadShifts(storage){const rows=JSON.parse(storage.getItem(SHIFT_STORAGE_KEY)||'[]');if(!Array.isArray(rows))throw Error('Invalid saved shifts');const ids=new Set();for(const row of rows){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.employeeId!=='string'||!row.employeeId||typeof row.week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.week)||new Date(row.week+'T12:00:00Z').getUTCDay()!==1||validateShifts([row]))throw Error('Invalid saved shift');ids.add(row.id);}return rows;}
export function scheduleForWeek(rows,employeeId,week){return rows.filter(r=>r.employeeId===employeeId&&r.week===week).map(r=>({...r,day:Number(r.day),breakMinutes:Number(r.breakMinutes)}));}
