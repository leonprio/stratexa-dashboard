import { contributionPickerCandidates, assertStrategicContributionParity } from './contributionConfiguration';
import { buildContributionMatrixViewModel } from './contributionMatrixViewModel';
import { strategyService } from './services/strategyService';
import { repairOperationalAssignmentReference } from './services/contributionAssignmentPersistence';

const mockStore = new Map<string, any>();
let mockFailCommit = false;
const mockWrites: string[] = [];
const mockSnap = (path:string) => ({id:path.split('/').pop(), exists:()=>mockStore.has(path), data:()=>mockStore.get(path)});
jest.mock('./firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({
  doc:(_db:any,...parts:string[])=>parts.join('/'), collection:(_db:any,...parts:string[])=>parts.join('/'),
  where:(...args:any[])=>args, query:(ref:any,...filters:any[])=>({ref,filters}),
  getDocs:async(q:any)=>({docs:[...mockStore.keys()].filter(p=>p.startsWith(q.ref+'/') && !p.slice(q.ref.length+1).includes('/') && q.filters.every(([k,_op,v]:any[])=>mockStore.get(p)[k]===v)).map(mockSnap)}),
  getDoc:async(ref:string)=>mockSnap(ref), setDoc:jest.fn(), deleteDoc:jest.fn(), writeBatch:jest.fn(),
  runTransaction:async(_db:any,fn:any)=>{const staged:any[]=[];const result=await fn({get:async(p:string)=>mockSnap(p),set:(p:string,d:any)=>staged.push(['set',p,d]),delete:(p:string)=>staged.push(['delete',p])});if(mockFailCommit)throw new Error('commit failed');for(const [op,p,d] of staged){mockWrites.push(op+':'+p);if(op==='set')mockStore.set(p,d);else mockStore.delete(p);}return result;},
}));

const cases = [
  ['Ventas','OCCOMV01','COMERCIAL'], ['Cumplimiento de Entregas','OCLOGT01','LOGÍSTICA'],
  ['Costo de Flete por Tonelada','OCLOGT02','LOGÍSTICA'], ['Exactitud de Inventario','OCOPAL01','OPERACIONES'],
  ['Días sin Accidentes Incidentes','OCOPAL02','OPERACIONES'],
];
function seed(name='Ventas', ocId='OCCOMV01',area='COMERCIAL') {
  const item={id:1,indicator:name};
  const board={id:100,clientId:'CLIENT',year:2026,area,items:[item]};
  const oc={id:ocId,clientId:'CLIENT',areaName:area,primaryStrategicObjectiveId:'OE',areaConfigId:'AREA'};
  const direct={id:'direct',clientId:'CLIENT',dashboardId:100,itemId:1,strategicObjectiveId:'OLD_OE'};
  mockStore.set('tbl_contributionObjectives/'+ocId,oc);
  mockStore.set('tbl_strategicObjectives/OE',{clientId:'CLIENT'});
  mockStore.set('tbl_areaStrategyConfigs/AREA',{clientId:'CLIENT',areaName:area,id:'AREA'});
  mockStore.set('tbl_dashboards/100',board);mockStore.set('tbl_dashboards/100/items/1',item);
  mockStore.set('tbl_contributionIndicatorAssignments/direct',direct);
  return {board,oc,direct};
}
beforeEach(()=>{mockStore.clear();mockWrites.length=0;mockFailCommit=false;});
it('enforces generic Objectives/Contribution logical parity',()=>{
  expect(assertStrategicContributionParity(['a','b'],['b','a'])).toEqual({objectivesOnly:[],contributionOnly:[],duplicates:0});
  expect(()=>assertStrategicContributionParity(['a','a'],['a'])).toThrow('duplicates=1');
});
describe('explicit physical reference repair',()=>{
  function legacy(){
    seed('Índice de Mermas en Tránsito','OCLOGT02','LOGÍSTICA');
    mockStore.delete('tbl_contributionIndicatorAssignments/direct');
    const old={id:'legacy',clientId:'CLIENT',contributionObjectiveId:'OCLOGT02',dashboardId:'agg-GENERAL-2026',itemId:-102,createdAt:'unchanged'};
    mockStore.set('tbl_contributionIndicatorAssignments/legacy',old);
    return old;
  }
  const target={dashboardId:100,itemId:1,logicalKpiId:'label:INDICE DE MERMAS EN TRANSITO',year:2026};
  it('repairs Mermas in place and changes only the two physical fields',async()=>{
    const old=legacy();await repairOperationalAssignmentReference(old,target);
    expect(mockStore.get('tbl_contributionIndicatorAssignments/legacy')).toEqual({...old,dashboardId:100,itemId:1});
    expect(mockWrites).toEqual(['set:tbl_contributionIndicatorAssignments/legacy']);
  });
  it('rejects a mismatched target without any writes',async()=>{
    const old=legacy();await expect(repairOperationalAssignmentReference(old,{...target,logicalKpiId:'label:OTRO KPI'})).rejects.toThrow('Identidad');
    expect(mockWrites).toHaveLength(0);expect(mockStore.get('tbl_contributionIndicatorAssignments/legacy')).toEqual(old);
  });
});
describe('normal configuration: persisted operational identity',()=>{
  it.each(cases)('%s converts once into %s',async(name,ocId,area)=>{
    const {board,oc,direct}=seed(name,ocId,area);
    const derived={...board,id:'agg-GENERAL-2026',isAggregate:true,items:[{id:-100,indicator:name}]};
    const candidates=contributionPickerCandidates([derived,board] as any,'CLIENT',area,[],ocId,[direct]);
    expect(candidates).toHaveLength(1);expect(candidates[0].dashboard.id).toBe(100);
    const input={dashboardId:100,itemId:1,year:2026,logicalKpiId:candidates[0].candidate.identity};
    await strategyService.saveAssignmentsForOC(ocId,[input],'CLIENT',{expectedAssignments:[]});
    const persisted=await strategyService.getAssignments('CLIENT');
    expect(persisted).toHaveLength(1);expect(persisted[0]).toMatchObject({dashboardId:100,itemId:1,contributionObjectiveId:ocId});
    expect(persisted[0].strategicObjectiveId).toBeUndefined();
    const projection=buildContributionMatrixViewModel([board] as any,[{id:'OE'}] as any,[oc] as any,[],persisted);
    expect(projection.strategicObjectives[0].contributionObjectives[0].kpis[0].item.indicator).toBe(name);
    const writes=mockWrites.length;await strategyService.saveAssignmentsForOC(ocId,[input],'CLIENT');expect(mockWrites).toHaveLength(writes);
  });
  it('failed OC commit preserves DIRECT',async()=>{seed();mockFailCommit=true;await expect(strategyService.saveAssignmentsForOC('OCCOMV01',[{dashboardId:100,itemId:1}],'CLIENT')).rejects.toThrow('commit failed');expect(mockStore.has('tbl_contributionIndicatorAssignments/direct')).toBe(true);expect(mockWrites).toHaveLength(0);});
  it('rejects a stale form without any writes',async()=>{seed();await expect(strategyService.saveAssignmentsForOC('OCCOMV01',[],'CLIENT',{expectedAssignments:[{id:'missing'} as any]})).rejects.toThrow('cambió');expect(mockWrites).toHaveLength(0);});
  it('rejects virtual aliases instead of deleting their direct owner',async()=>{seed();await expect(strategyService.saveAssignmentsForOC('OCCOMV01',[{dashboardId:'agg-GENERAL-2026',itemId:-100}],'CLIENT')).rejects.toThrow('virtual');expect(mockWrites).toHaveLength(0);});
  it('keeps same-OE DIRECT selectable; excludes other areas and tenants',()=>{const {board,direct}=seed();const candidates=contributionPickerCandidates([board,{...board,id:2,clientId:'OTHER'},{...board,id:3,area:'OTHER',items:[{id:4,indicator:'Other KPI'}]}] as any,'CLIENT','COMERCIAL',[],'OCCOMV01',[{...direct,strategicObjectiveId:'OE'}]);expect(candidates).toHaveLength(1);expect(candidates[0].dashboard.id).toBe(100);});
  it('validates the physical area server-side',async()=>{seed();mockStore.get('tbl_dashboards/100').area='OTHER';await expect(strategyService.saveAssignmentsForOC('OCCOMV01',[{dashboardId:100,itemId:1}],'CLIENT')).rejects.toThrow('área');expect(mockWrites).toHaveLength(0);});
});
