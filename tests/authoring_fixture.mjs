// Export through the same browser data/ZIP functions, consumed by native tests.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {workspace,normalizeWorkspace,ankiTSV,rectangleHTML} from '../tools/data.mjs';
import {zipFiles} from '../tools/zip.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const specs=JSON.parse(fs.readFileSync(path.join(root,'note-types.json'),'utf8'));
export async function fixture() {
  const data=workspace();data.deck='制卡测试::中文';
  const image=fs.readFileSync(path.join(root,'preview-choice.png'));
  const hash=await crypto.subtle.digest('SHA-256',image);
  const name='at-'+Buffer.from(hash).toString('hex').slice(0,32)+'.png';
  data.media=[{name,data:'data:image/png;base64,'+image.toString('base64')}];
  const samples=JSON.parse(fs.readFileSync(path.join(root,'samples.json'),'utf8'));
  data.notes=samples.filter(s=>!['minimal','rich'].includes(s.key)).map((s,i)=>({...s,guid:'authoring-test-'+i}));
  data.notes[0].guid='aE$<>&:;+/'; // Native Anki base91 GUID characters are preserved.
  data.notes[0].fields.问题='<p># UTF-8 测试："引号"\t制表符，换行\n第二行 &amp; ` ${value}</p>';
  data.notes[0].fields.答案='<pre><code>url(只是代码)\nconsole.log("测试");</code></pre><img src="'+name+'" alt="自有测试图">';
  data.notes.find(n=>n.type==='mindmap').fields.内容='<ul><li>完整章节<ul><li>{{c1::<img src="'+name+'" alt="图片答案">}}</li><li>{{c3::答案::提示}}</li><li>{{c1::同号}}</li></ul></li></ul>';
  const io=data.notes.find(n=>n.type==='occlusion');io.fields.Image='<img src="'+name+'">';
  io.fields.Occlusion=rectangleHTML([{group:1,left:.1,top:.2,width:.2,height:.1},{group:1,left:.4,top:.4,width:.2,height:.1},{group:3,left:.7,top:.7,width:.2,height:.1}]);
  return normalizeWorkspace(data,specs);
}
if(process.argv[2]) {
  const dir=path.resolve(process.argv[2]);fs.mkdirSync(dir,{recursive:true});const data=await fixture();
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(data));
  const files=[['workspace.json',JSON.stringify(data)]];
  for(const spec of specs){const notes=data.notes.filter(n=>n.type===spec.key);const text=ankiTSV(notes,spec,data.deck);fs.writeFileSync(path.join(dir,spec.key+'.tsv'),text);files.push([spec.name+'.tsv',text]);}
  for(const media of data.media)files.push(['media/'+media.name,Buffer.from(media.data.split(',')[1],'base64')]);
  fs.writeFileSync(path.join(dir,'export.zip'),zipFiles(files));
}
