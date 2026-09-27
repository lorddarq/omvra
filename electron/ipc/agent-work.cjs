const { safeError } = require('../services/agent-work-contract.cjs');
function registerAgentWorkIpcHandlers({ipcMain,ready}) {
  const handle=(channel,method)=>ipcMain.handle(channel,async(_,input)=>{
    try {return {ok:true,value:await (await ready).maintenance[method](input)};}
    catch(error) {return {ok:false,error:safeError(error).code};}
  });
  handle('agent-work/status','status');
  handle('agent-work/preview','preview');
  handle('agent-work/execute','execute');
  handle('agent-work/cancel','cancel');
}
module.exports={registerAgentWorkIpcHandlers};
