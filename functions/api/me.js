import {json,currentUser} from '../../lib/utils.js';
export function onRequestGet(context) { return json(currentUser(context)); }
