import type {PrivateSql} from './private-data-sql.js';

/** A producer snapshot precedes actual Memory task admission. Closing it only
 * forbids future admissions; existing intake receipts keep their own authority. */
export function closeCaptureAdmissions(sql:PrivateSql){
 sql.run("UPDATE mm_capture_intakes SET json=json_set(json,'$.admissionClosed',json('true')) WHERE user_id=$user AND revoked=0 AND coalesce(json_extract(json,'$.admissionClosed'),0)!=1");
}
