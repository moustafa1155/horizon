export function validateShifts(rows){
 const minutes=v=>v.split(':').reduce((sum,n,i)=>sum+Number(n)*(i?1:60),0);
 for(const row of rows){if(!Number.isInteger(Number(row.day))||Number(row.day)<0||Number(row.day)>6||!/^\d{2}:\d{2}$/.test(row.start)||!/^\d{2}:\d{2}$/.test(row.end))return 'Choose a day and both times for every shift.';const duration=minutes(row.end)-minutes(row.start);if(duration<=0||!Number.isInteger(Number(row.breakMinutes))||Number(row.breakMinutes)<0||Number(row.breakMinutes)>=duration)return 'End time must follow start time and breaks must be shorter than the shift.';}
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(Number(rows[i].day)===Number(rows[j].day)&&rows[i].start<rows[j].end&&rows[i].end>rows[j].start)return 'Two shifts overlap on the same day.';
 return '';
}
