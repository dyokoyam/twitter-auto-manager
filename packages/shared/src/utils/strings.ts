export function truncate(s: string, n=140){ return s.length>n ? s.slice(0,n-1)+'…' : s; }
