import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

/** Follow the same durable check receipt that clients poll after HTTP admission. */
export async function waitForPluginCheck(receipt:{taskId:string},read:(taskId:string)=>Promise<any>,expected='succeeded'){
 const deadline=Date.now()+30000;for(;;){const task=await read(receipt.taskId);if(!['waiting','running'].includes(task.state)){assert.equal(task.state,expected,JSON.stringify(task));return task;}assert.ok(Date.now()<deadline,JSON.stringify(task));await delay(5);}
}
