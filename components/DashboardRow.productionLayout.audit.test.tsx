import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardRow } from './DashboardRow';
import { DashboardRole } from '../types';
jest.mock('./DataEditor',()=>({DataEditor:()=> <div data-testid="configuration-editor">CONFIGURATION</div>}));
jest.mock('./LineChart',()=>({LineChart:()=>null}));
jest.mock('./ActionPlan',()=>({ActionPlan:()=>null}));
jest.mock('./SummaryDetails',()=>({SummaryDetails:()=>null}));
const item:any={id:101,indicator:'SOSTENIBILIDAD KPI',unit:'%',weight:1,type:'accumulative',goalType:'maximize',frequency:'monthly',monthlyProgress:[],monthlyGoals:[]};
const props={item,onUpdateItem:jest.fn(),globalThresholds:{onTrack:90,atRisk:80},userRoleForDashboard:DashboardRole.Editor,year:2026,onSelect:jest.fn()};
it('RUNTIME-02 characterization: changing grid to compact does not open an editor; clicking KPI only selects it',()=>{
 const {rerender}=render(<DashboardRow {...props} layout="grid"/>);
 rerender(<DashboardRow {...props} layout="compact"/>);
 expect(screen.queryByTestId('configuration-editor')).not.toBeInTheDocument();
 fireEvent.click(screen.getByText('SOSTENIBILIDAD KPI'));
 expect(props.onSelect).toHaveBeenCalledTimes(1);
 expect(screen.queryByTestId('configuration-editor')).not.toBeInTheDocument();
});
it('RUNTIME-02 characterization: an explicitly open editor survives a layout change',()=>{
 const {rerender}=render(<DashboardRow {...props} layout="grid"/>);
 fireEvent.click(screen.getByText('SOSTENIBILIDAD KPI'));
 fireEvent.click(screen.getByRole('button',{name:'Capturar Datos'}));
 expect(screen.getByTestId('configuration-editor')).toBeInTheDocument();
 rerender(<DashboardRow {...props} layout="compact"/>);
 expect(screen.getByTestId('configuration-editor')).toBeInTheDocument();
});
