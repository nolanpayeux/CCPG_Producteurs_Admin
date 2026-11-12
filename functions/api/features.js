import {json,db} from '../../lib/utils.js';
export async function onRequestGet(context) {
  try {
    const {results} = await db(context).prepare('SELECT feature_id,feature_json,version FROM published_features WHERE deleted=0 ORDER BY feature_id').all();
    return json({items:results.map(row=>({id:row.feature_id,version:row.version,feature:JSON.parse(row.feature_json)}))});
  } catch (e) {console.error(e);return json({error:'Impossible de lire les données D1.'},503);}
}
