// Run on parent's trusted machine. Keep the signing secret OUT of the browser.
import {randomBytes,createHmac} from 'node:crypto';
const secret=process.env.SESSION_SIGNING_SECRET;
if(!secret||secret.length<32)throw Error('Set SESSION_SIGNING_SECRET securely (at least 32 random characters).');
const payload=Buffer.from(JSON.stringify({lesson:'6-1',jti:randomBytes(18).toString('base64url'),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
process.stdout.write(payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')+'\n');
