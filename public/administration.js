'use strict';
const $ = id => document.getElementById(id);
const categories = ['Vin Bio','Vin',"Huiles d'olives",'Marché local','Légumes et fruits','Boucheries','Oeufs','Fromagerie','Conserves','Miel'];
for (const cat of categories) $('categorie').add(new Option(cat,cat));
let who = null, features = [], proposals = [];
const editable = ['name','categorie','Adresse','tel','liens','description','site_id','site_nom'];
function status(s){ $('status').textContent=s; }
async function api(url,options={}){
  const r=await fetch(url,{credentials:'same-origin',...options,headers:{'Accept':'application/json',...(options.headers||{})}});
  let data;try{data=await r.json()}catch{throw new Error(`HTTP ${r.status}`)}
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data;
}
function selected(){return features.find(x=>x.id===$('feature-select').value);}
function renderFeatureList(){
  const match=$('filter').value.trim().toLowerCase();const old=$('feature-select').value;
  $('feature-select').replaceChildren(new Option('— Nouvelle fiche —',''));
  for(const item of features){
    const p=item.feature.properties||{};if(![p.name,p.Adresse,p.categorie].some(x=>String(x||'').toLowerCase().includes(match)))continue;
    $('feature-select').add(new Option(`${p.name||'Sans nom'} · ${p.categorie||'Sans catégorie'}`,item.id));
  }
  if([...$('feature-select').options].some(x=>x.value===old))$('feature-select').value=old;
  fillForm();
}
function fillForm(){
  const item=selected();const p=item?.feature.properties||{};
  for(const f of editable){$(f==='Adresse'?'adresse':f).value=p[f]??'';}
  const coordinates=item?.feature.geometry?.coordinates||['',''];
  $('lon').value=coordinates[0];$('lat').value=coordinates[1];$('delete').disabled=!item;
}
function formFeature(){
  const source=selected()?.feature;
  const feature=source?structuredClone(source):{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[]}};
  for(const f of editable){feature.properties[f]=$(f==='Adresse'?'adresse':f).value.trim();}
  feature.geometry={type:'Point',coordinates:[Number($('lon').value),Number($('lat').value)]};
  if(!$('lat').value||!$('lon').value||!feature.properties.name||!feature.properties.categorie)throw new Error('Nom, catégorie et coordonnées obligatoires.');
  return feature;
}
function node(tag,text,cls=''){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=text;return e;}
function renderProposals(){
  const list=$('proposals');list.replaceChildren();
  for(const p of proposals){
    const item=node('article','', 'proposal');
    const name=p.after?.properties?.name||p.before?.properties?.name||p.feature_id;
    item.append(node('h3',`${p.operation.toUpperCase()} · ${name} · ${p.status}`));
    item.append(node('div',`${p.proposed_by} · ${p.created_at} · ID ${p.id}`,'meta'));
    if(p.before||p.after){
      const diff=node('div','','diff');for(const [title,feature] of [['Avant',p.before],['Proposé',p.after]]){
        const col=node('div','');col.append(node('strong',title));col.append(node('pre',feature?JSON.stringify(feature,null,2):'Aucun'));diff.append(col);
      }item.append(diff);
    }
    if(p.review_note)item.append(node('p',`Avis : ${p.review_note}`,'meta'));
    if(who?.role==='admin'&&p.status==='pending'){
      const note=node('textarea','');note.placeholder='Commentaire de validation (facultatif)';item.append(note);
      const actions=node('div','','actions');
      for(const [label,decision] of [['Approuver','approve'],['Refuser','reject']]){
        const b=node('button',label,decision==='approve'?'primary':'danger');
        b.onclick=async()=>{
          if(!confirm(`${label} la proposition « ${name} » ?`))return;
          try{await api(`/api/proposals/${encodeURIComponent(p.id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,note:note.value})});status('Décision enregistrée dans D1.');await reload();}
          catch(e){status(`Erreur : ${e.message}`)}
        };actions.append(b);
      }item.append(actions);
    }
    list.append(item);
  }
}
async function reload(){
  const [fs,ps]=await Promise.all([api('/api/features'),api('/api/proposals')]);
  features=fs.items;proposals=ps.items;renderFeatureList();renderProposals();
}
$('filter').oninput=renderFeatureList;
$('feature-select').onchange=fillForm;
$('submit').onclick=async()=>{
  try{
    const f=formFeature(), current=selected();
    const message=await api('/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:current?'update':'create',feature_id:current?.id,feature:f})});
    status(message.message);await reload();
  }catch(e){status(`Erreur : ${e.message}`)}
};
$('delete').onclick=async()=>{
  const current=selected();if(!current||!confirm('Proposer la suppression de cette fiche ?'))return;
  try{const d=await api('/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'delete',feature_id:current.id})});status(d.message);await reload();}
  catch(e){status(`Erreur : ${e.message}`)}
};
(async()=>{
  try{who=await api('/api/me');$('identity').textContent=`${who.email} · ${who.role==='admin'?'Administrateur':'Éditeur'}`;await reload();status('Prêt. Les propositions ne modifient pas la carte publique.');}
  catch(e){status(`Impossible d’ouvrir l’administration : ${e.message}. Vérifie Cloudflare Access et la base D1.`);}
})();
