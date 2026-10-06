import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {ContributionMatrixView} from './ContributionMatrixView';
import {StrategyConfigModal} from './StrategyConfigModal';
import type {User} from '../../types';
jest.mock('../../services/strategyService',()=>({strategyService:{}}));
jest.mock('./StrategyMapView',()=>({StrategyMapView:()=>null}));
const props={perspectives:[],objectives:[],areaConfigs:[],contributionObjectives:[],assignments:[],dashboards:[],selectedClientId:'A',onRefreshData:jest.fn()};
test.each(['canonical','legacy','viewer','foreign','suspended','configurator','hybrid'])('H02 strategy authority %s',kind=>{
 const currentUser={id:'u',email:'u@example.test',name:'U',clientId:'A',globalRole:kind==='legacy'||kind==='hybrid'?'Admin':'Member',memberships:kind==='legacy'?undefined:[{clientId:kind==='foreign'?'B':'A',role:kind==='canonical'||kind==='foreign'||kind==='suspended'?'tenant_admin':'standard_user',status:kind==='suspended'?'suspended':'active',capabilities:kind==='configurator'?['strategy_configurator','strategy_reader']:[],dashboardScopes:{},hierarchyScopes:[],editableDashboardIds:[]}]} as User;
 const allowed=kind==='canonical'||kind==='legacy';
 const view=render(<ContributionMatrixView {...props} currentUser={currentUser}/>);
 const button=screen.queryByRole('button',{name:/Configurar Estrategia/});
 if(allowed){expect(button).toBeInTheDocument();fireEvent.click(button!);expect(screen.getByText('Gestión de Arquitectura Estratégica')).toBeInTheDocument();}
 else expect(button).not.toBeInTheDocument();
 view.unmount();render(<StrategyConfigModal {...props} currentUser={currentUser} onClose={jest.fn()}/>);
 expect(!!screen.queryByText('Acceso Restringido (RBAC)')).toBe(!allowed);
});
