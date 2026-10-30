// Local static development only. No credentials, paid calls or insecure alternate API.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+(p==='/'?'/index.html':p));if(!path.startsWith(root+'/')||p.includes('/.')||!['.html','.js','.css','.json','.png'].includes(extname(path))||/\/(server|tests|scripts|cloudflare)\//.test(p)){res.writeHead(404);return res.end('Not found')}const content=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(content)}catch{res.writeHead(404);res.end('Not found')}});
server.listen(Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1]||5173),'0.0.0.0',()=>console.log('Local tutor preview ready'));
