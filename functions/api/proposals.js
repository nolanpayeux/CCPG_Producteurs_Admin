import {json,error,db,currentUser,isAdmin,inputJson,validateFeature} from '../../lib/utils.js';
export async function onRequestGet(context) {
  try {
    const user = currentUser(context);
    const query = isAdmin(context)
      ? db(context).prepare('SELECT * FROM proposals ORDER BY created_at DESC LIMIT 300')
      : db(context).prepare('SELECT * FROM proposals WHERE proposed_by=? ORDER BY created_at DESC LIMIT 300').bind(user.email);
    const {results} = await query.all();
    return json({items:results.map(p=>({...p,before:p.before_json?JSON.parse(p.before_json):null,after:p.after_json?JSON.parse(p.after_json):null,before_json:undefined,after_json:undefined}))});
  } catch(e){console.error(e);return error('Impossible de lire les propositions.',503);}
}
export async function onRequestPost(context) {
  try {
    const body = await inputJson(context.request);
    const operation = body.operation;
    if (!['create','update','delete'].includes(operation)) return error('Opération invalide.');
    const database = db(context);
    const id = operation === 'create' ? crypto.randomUUID() : String(body.feature_id || '').trim();
    if (!id || id.length > 120) return error('Identifiant invalide.');
    let before = null, version = 0, after = null;
    if (operation !== 'create') {
      const row = await database.prepare('SELECT feature_json,version FROM published_features WHERE feature_id=? AND deleted=0').bind(id).first();
      if (!row) return error('Fiche introuvable.',404);
      version = row.version; before=JSON.parse(row.feature_json);
    }
    if (operation !== 'delete') after = validateFeature(body.feature);
    const proposalId = crypto.randomUUID();
    await database.prepare('INSERT INTO proposals (id,operation,feature_id,base_version,before_json,after_json,proposed_by) VALUES (?,?,?,?,?,?,?)')
      .bind(proposalId,operation,id,version,before?JSON.stringify(before):null,after?JSON.stringify(after):null,currentUser(context).email).run();
    return json({id:proposalId,status:'pending',message:'Proposition transmise à l’administrateur ; la carte publique reste inchangée.'},201);
  } catch(e){console.error(e);return error(e.message==='Unexpected end of JSON input'?'JSON invalide.':e.message || 'Erreur de proposition.',400);}
}
