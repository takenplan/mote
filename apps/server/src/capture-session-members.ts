import {CAPTURE_SESSION_GAP_MS} from '@mote/shared/capture-sessions';

/** Segment observed screens before app/processing filters or pagination. */
export function captureSessionMembersSql(deviceId?:string){return `WITH observed AS (
 SELECT *,LAG(app_id) OVER w AS previous_app,LAG(captured_at) OVER w AS previous_at
 FROM capture_gallery WHERE captured_at>=? AND captured_at<? ${deviceId?'AND device_id=?':''}
 WINDOW w AS (PARTITION BY device_id ORDER BY captured_at,id)
), segmented AS (
 SELECT *,SUM(CASE WHEN previous_at IS NULL OR app_id='' OR app_id!=previous_app OR
 (julianday(captured_at)-julianday(previous_at))*86400000>${CAPTURE_SESSION_GAP_MS+0.1} THEN 1 ELSE 0 END)
 OVER (PARTITION BY device_id ORDER BY captured_at,id) AS segment FROM observed
), members AS (
 SELECT *,FIRST_VALUE(id) OVER (PARTITION BY device_id,segment ORDER BY captured_at,id) AS session_id FROM segmented
)`;}
