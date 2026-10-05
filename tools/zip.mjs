/* Copyright (c) 2026 zzpice. MIT License. */
// Small, uncompressed ZIP writer for UTF-8 text and local images. No reader or SQLite.
const table = Array.from({length:256}, (_,n) => {
  for (let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function zipFiles(files) {
  const encoder = new TextEncoder(); const chunks = [], central = []; let offset=0;
  for (const [path, value] of files) {
    if (!path || path.startsWith('/') || path.split('/').some(p => !p || p === '..' || p === '.') || path.includes('\\')) throw new Error('ZIP 路径无效');
    const name = encoder.encode(path), data = typeof value === 'string' ? encoder.encode(value) : value;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length), a = new DataView(local.buffer);
    a.setUint32(0,0x04034b50,true); a.setUint16(4,20,true); a.setUint16(6,0x800,true);
    a.setUint16(12,33,true); a.setUint32(14,crc,true); a.setUint32(18,data.length,true); a.setUint32(22,data.length,true); a.setUint16(26,name.length,true);
    local.set(name,30); chunks.push(local,data);
    const record = new Uint8Array(46 + name.length), b = new DataView(record.buffer);
    b.setUint32(0,0x02014b50,true); b.setUint16(4,20,true); b.setUint16(6,20,true); b.setUint16(8,0x800,true);
    b.setUint16(14,33,true); b.setUint32(16,crc,true); b.setUint32(20,data.length,true); b.setUint32(24,data.length,true); b.setUint16(28,name.length,true); b.setUint32(42,offset,true);
    record.set(name,46); central.push(record); offset += local.length + data.length;
  }
  const size = central.reduce((n,c) => n+c.length,0);
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0,0x06054b50,true); view.setUint16(8,files.length,true); view.setUint16(10,files.length,true); view.setUint32(12,size,true); view.setUint32(16,offset,true);
  const bytes = new Uint8Array(offset+size+end.length); let i=0;
  for (const part of [...chunks,...central,end]) { bytes.set(part,i); i+=part.length; }
  return bytes;
}
