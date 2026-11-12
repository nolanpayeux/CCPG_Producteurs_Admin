import {json,error,db,isAdmin,currentUser,inputJson} from '../../../lib/utils.js';
export async function onRequestPost(context) {
  if (!isAdmin(context)) return error('Validation réservée à l’administrateur.',403);
  try {
    const id = String(context.params.id || '');
    const body = await inputJson(context.request);
    if (!['approve','reject'].includes(body.decision)) return error('Décision invalide.');
    const database = db(context);
    const p = await database.prepare('SELECT * FROM proposals WHERE id=?').bind(id).first();
    if (!p) return error('Proposition introuvable.',404);
    if (p.status !== 'pending') return error('Proposition déjà traitée.',409);
    const note = String(body.note || '').slice(0,1500);
    const who = currentUser(context).email;
    if (body.decision === 'reject') {
      const result=await database.prepare("UPDATE proposals SET status='rejected',reviewed_by=?,reviewed_at=datetime('now'),review_note=? WHERE id=? AND status='pending'").bind(who,note,id).run();
      return result.meta.changes===1?json({status:'rejected'}):error('Proposition déjà traitée.',409);
    }
    // Basculement des données D1 : la carte publique statique n’est pas modifiée à cette étape pilote.
    const target = p.feature_id;
    const wantedVersion = p.base_version + 1;
    const conditional = `(SELECT status FROM proposals WHERE id=?)='pending'`;
    let stmt;
    if (p.operation === 'create') {
      stmt = database.prepare(`INSERT OR IGNORE INTO published_features (feature_id,feature_json,version,deleted) SELECT ?,?,1,0 WHERE ${conditional}`).bind(target,p.after_json,id);
    } else if (p.operation === 'update') {
      stmt = database.prepare(`UPDATE published_features SET feature_json=?, version=version+1,updated_at=datetime('now') WHERE feature_id=? AND version=? AND deleted=0 AND ${conditional}`)
        .bind(p.after_json,target,p.base_version,id);
    } else {
      stmt = database.prepare(`UPDATE published_features SET deleted=1,version=version+1,updated_at=datetime('now') WHERE feature_id=? AND version=? AND deleted=0 AND ${conditional}`)
        .bind(target,p.base_version,id);
    }
    // Transaction D1 batch : un seul gagnant pour une révision donnée ; le statut n’est validé que si elle évolue.
    const result = await database.batch([
      stmt,
      database.prepare(`UPDATE proposals SET status='approved',reviewed_by=?,reviewed_at=datetime('now'),review_note=? WHERE id=? AND status='pending' AND changes()=1`)
        .bind(who,note,id)
    ]);
    if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1) return error('Conflit de version. Actualisez les propositions avant de valider.',409);
    return json({status:'approved',feature_id:target,version:wantedVersion});
  } catch(e){console.error(e);return error('Erreur lors de la validation.',503);}
}
