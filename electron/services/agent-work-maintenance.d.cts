import type { Metrics, RetentionPolicy } from './agent-work-repository.cjs';
export type DataPolicyAction = 'policy' | 'prune' | 'compact';
export type PolicyPreview = {
  id: string; action: DataPolicyAction; expiresAt: number; policyVersion: number; policy: RetentionPolicy;
  eligible: Record<string,number>; estimatedBytes: number; freeBytes: number;
  protectedRecords: {count:number;oldest:number|null;estimatedBytes:number;categories:Record<string,number>;reason:string};
};
export type MaintenanceOperation = {id:string;previewId:string;action:DataPolicyAction;status:'running'|'completed'|'cancelled'|'deferred'|'failed';deletedRows:number;summariesCleared:number;reclaimedBytes:number;batches:number;cancelRequested:boolean;startedAt:number;finishedAt?:number;reason?:string;error?:string};
export type DataPolicyStatus = {metrics:Metrics;defaults:RetentionPolicy;operation:MaintenanceOperation|null};
export type DataPolicyResult<T> = {ok:true;value:T}|{ok:false;error:string};
export type AgentWorkApi = {
  status():Promise<DataPolicyResult<DataPolicyStatus>>;
  preview(input:{action:DataPolicyAction;policy?:RetentionPolicy}):Promise<DataPolicyResult<PolicyPreview>>;
  execute(id:string):Promise<DataPolicyResult<MaintenanceOperation>>;
  cancel(id:string):Promise<DataPolicyResult<MaintenanceOperation>>;
};
