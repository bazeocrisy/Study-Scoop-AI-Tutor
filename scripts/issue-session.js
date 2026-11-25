// Run on parent's trusted machine. Keep the signing secret OUT of the browser.
// Usage: SESSION_SIGNING_SECRET=... node scripts/issue-session.js [lesson-id]   (default: registry default)
import {randomBytes,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync(new URL('../curriculum/registry.json',import.meta.url),'utf8'));
const lesson=process.argv[2]||registry.default;
if(!registry.lessons.some(l=>l.id===lesson))throw Error(`Unknown lesson "${lesson}". Registered: ${registry.lessons.map(l=>l.id).join(', ')}`);
const secret=process.env.SESSION_SIGNING_SECRET;
if(!secret||secret.length<32)throw Error('Set SESSION_SIGNING_SECRET securely (at least 32 random characters).');
const payload=Buffer.from(JSON.stringify({lesson,jti:randomBytes(18).toString('base64url'),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
process.stdout.write(payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')+'\n');
