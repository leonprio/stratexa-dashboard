import { buildPendingItems, getPendingActionTarget, getPendingCategoryCounts } from './pendingAlerts';
import type { Dashboard } from '../types';
const p={frequency:'monthly' as const,year:2026,monthIndex:7};
const d=(id:number,goal:number|null,progress:number|null,start:any):Dashboard=>({id,title:'D',subtitle:'',area:'A',thresholds:{onTrack:95,atRisk:85},items:[{id,indicator:`KPI ${id}`,weight:1,monthlyGoals:Object.assign(Array(12).fill(null),{7:goal}),monthlyProgress:Object.assign(Array(12).fill(null),{7:progress}),monthlyGoalCaptured:Object.assign(Array(12).fill(false),{7:goal!==null}),monthlyProgressCaptured:Object.assign(Array(12).fill(false),{7:progress!==null}),unit:'u',type:'accumulative',goalType:'maximize',trackingStartPeriod:start}]});
test('excludes pre-start/future and raises canonical capture states',()=>{const x=buildPendingItems([d(1,null,null,undefined),d(2,null,null,p),d(3,1,null,p),d(4,null,null,{...p,monthIndex:9})],p,p,[1,2,3,4]);expect(x.map(i=>i.type)).toEqual(['TRACKING_START_UNDEFINED','MISSING_GOAL','MISSING_PROGRESS']);});
test('explicit zero progress is complete and low performance is separate',()=>{const x=buildPendingItems([d(1,10,0,p),d(2,100,100,p)],p,p,[1,2]);expect(x).toHaveLength(1);expect(x[0].type).toBe('RESULT_CRITICAL');expect(x[0].source).toBe('performance');});
test('authorized read scope and priority sorting',()=>{const x=buildPendingItems([d(1,1,null,p),d(2,null,null,p)],p,p,[2]);expect(x).toHaveLength(1);expect(x[0].type).toBe('MISSING_GOAL');});
test('categorizes complete critical and at-risk capture while excluding normal',()=>{const x=buildPendingItems([d(1,100,40,p),d(2,100,80,p),d(3,100,100,p)],p,p,[1,2,3]);expect(x.map(i=>i.type)).toEqual(['RESULT_CRITICAL','RESULT_AT_RISK']);expect(getPendingCategoryCounts(x)).toEqual({CONFIGURACIÓN:0,CAPTURA:0,RESULTADO:2});});
test('provides a real KPI navigation target for each pending action',()=>{const [item]=buildPendingItems([d(7,null,null,p)],p,p,[7]);expect(getPendingActionTarget(item)).toEqual({dashboardId:7,itemId:7});});
test('inherits client tracking start so configured KPIs do not enter configuration',()=>{
  const clientStart = { frequency:'monthly' as const, year:2026, monthIndex:0 };
  const x=buildPendingItems([d(8,null,null,undefined)],p,p,[8],{defaultTrackingStartPeriod:clientStart});
  expect(x[0]?.type).toBe('MISSING_GOAL');
  expect(x[0]?.category).toBe('CONFIGURACIÓN');
});
test('continuity scheduled in current period does not invent a new goal',()=>{
  const source:any = d(9,null,null,p);
  source.items[0].isActivityMode = true;
  source.items[0].activityConfig = { 7: [{ id:'aug', label:'Agosto', targetCount:10, completedCount:3 }] };
  source.items[0].continuityCommitments = { 'activity:aug': { status:'active', scheduledYear:2026, scheduledPeriod:8 } };
  expect(buildPendingItems([source],{...p,monthIndex:8},{...p,monthIndex:8},[9])).toHaveLength(0);
});
test('simple-KPI continuity suppresses only the inherited missing-goal alert and keeps a real new goal independent',()=>{
  const inherited:any = d(11,null,null,p);
  inherited.items[0].continuityCommitments = { 'simple-kpi:11:monthly:2026:7': { sourceType:'SIMPLE_KPI', status:'active', scheduledYear:2026, scheduledPeriod:8, frequency:'monthly' } };
  expect(buildPendingItems([inherited],{...p,monthIndex:8},{...p,monthIndex:8},[11])).toHaveLength(0);
  inherited.items[0].monthlyGoals[8] = 6;
  inherited.items[0].monthlyGoalCaptured[8] = true;
  const pending = buildPendingItems([inherited],{...p,monthIndex:8},{...p,monthIndex:8},[11]);
  expect(pending.map(x => x.type)).toEqual(['MISSING_PROGRESS']);
});
test('new activity in current period creates a capture obligation',()=>{
  const source:any = d(10,null,null,p);
  source.items[0].isActivityMode = true;
  source.items[0].activityConfig = { 8: [{ id:'sep', label:'Septiembre', targetCount:2, completedCount:0 }] };
  const [pending] = buildPendingItems([source],{...p,monthIndex:8},{...p,monthIndex:8},[10]);
  expect(pending.type).toBe('MISSING_PROGRESS');
});
