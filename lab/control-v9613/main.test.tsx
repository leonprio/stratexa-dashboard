import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ControlVisualLab } from './main';

beforeEach(() => {
  localStorage.removeItem('tablero-control-v9613-synthetic-only');
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25));
});
afterEach(() => jest.useRealTimers());

test('CONFIGURAR opens the correct KPI and returns to CONTROL with only local state', () => {
  render(<ControlVisualLab />);
  fireEvent.click(screen.getByRole('button', { name: 'CONFIGURAR' }));
  const destination = screen.getByRole('region', { name: 'Vista funcional del KPI' });
  expect(destination).toHaveTextContent('TABLERO CONFIGURACIÓN · PRUEBA');
  expect(destination).toHaveTextContent('KPI ID: 401 · Período: Septiembre 2026');
  fireEvent.change(within(destination).getByRole('spinbutton'), { target: { value: '9' } });
  fireEvent.click(within(destination).getByRole('button', { name: 'APLICAR EN MEMORIA LOCAL' }));
  expect(destination).toHaveTextContent('Meta: 9');
  fireEvent.click(within(destination).getByRole('button', { name: /VOLVER A CONTROL/ }));
  expect(screen.getByRole('region', { name: 'Pendientes inteligentes' })).toBeInTheDocument();
});

test('REGISTRAR AVANCE opens capture for the selected period and returns', () => {
  render(<ControlVisualLab />);
  fireEvent.click(screen.getByRole('button', { name: 'REGISTRAR AVANCE' }));
  const destination = screen.getByRole('region', { name: 'Vista funcional del KPI' });
  expect(destination).toHaveTextContent('TABLERO CAPTURA · PRUEBA');
  expect(destination).toHaveTextContent('KPI ID: 501 · Período: Septiembre 2026');
  fireEvent.change(within(destination).getByRole('spinbutton'), { target: { value: '4' } });
  fireEvent.click(within(destination).getByRole('button', { name: 'APLICAR EN MEMORIA LOCAL' }));
  expect(destination).toHaveTextContent('Realizado: 4');
  fireEvent.click(within(destination).getByRole('button', { name: /VOLVER A CONTROL/ }));
  expect(screen.getByRole('region', { name: 'Pendientes inteligentes' })).toBeInTheDocument();
});

test('GESTIONAR keeps each homonymous KPI distinct even after filtering', () => {
  render(<ControlVisualLab />);
  fireEvent.change(screen.getByLabelText('Filtrar pendientes por categoría'), { target: { value: 'RESULTADO' } });
  for (const [index, dashboard, id] of [[0, 'NORTE', '1011'], [1, 'CENTRO', '1021'], [2, 'SUR', '1031']] as const) {
    fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[index]);
    const destination = screen.getByRole('region', { name: 'Vista funcional del KPI' });
    expect(destination).toHaveTextContent(`TABLERO INCLUSIÓN · ${dashboard}`);
    expect(destination).toHaveTextContent(`KPI ID: ${id} · Período: Septiembre 2026`);
    fireEvent.click(within(destination).getByRole('button', { name: /VOLVER A CONTROL/ }));
  }
});

test('GESTIONAR edits Norte through the real ActivityManager and leaves Centro and Sur intact', () => {
  render(<ControlVisualLab />);
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'GESTIÓN DETALLADA DE ACTIVIDADES' }));
  expect(screen.getByText('CONFIRMAR LISTA')).toBeInTheDocument();
  const firstActivity = screen.getByText('Actividad de prueba A').closest('.group');
  expect(firstActivity).not.toBeNull();
  fireEvent.change(within(firstActivity as HTMLElement).getAllByRole('textbox')[1], { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));
  expect(screen.getByRole('region', { name: 'Vista funcional del KPI' })).toHaveTextContent('Realizado: 5');
  expect(screen.getByRole('region', { name: 'Vista funcional del KPI' })).toHaveTextContent('Pendiente: 5');
  fireEvent.click(screen.getByRole('button', { name: /VOLVER A CONTROL/ }));
  const resultCards = screen.getAllByRole('button', { name: 'GESTIONAR' });
  expect(resultCards[0].closest('article')).toHaveTextContent('Realizado: 5');
  expect(resultCards[1].closest('article')).toHaveTextContent('Realizado: 2');
  expect(resultCards[2].closest('article')).toHaveTextContent('Realizado: 1');
  expect(localStorage.getItem('tablero-control-v9613-synthetic-only')).toContain('"completedCount":4');
});

test('two synthetic clients keep homonymous KPI writes and return context isolated', () => {
  render(<ControlVisualLab />);
  fireEvent.change(screen.getByLabelText('Cliente ficticio'), { target: { value: 'LAB-B' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[0]);
  const destination = screen.getByRole('region', { name: 'Vista funcional del KPI' });
  expect(destination).toHaveTextContent('Cliente: LAB-B · Tablero: TABLERO INCLUSIÓN · ORIENTE');
  expect(destination).toHaveTextContent('KPI ID: 1011 · Período: Septiembre 2026');
  fireEvent.click(screen.getByRole('button', { name: 'GESTIÓN DETALLADA DE ACTIVIDADES' }));
  const firstActivity = screen.getByText('Actividad de prueba A').closest('.group');
  fireEvent.change(within(firstActivity as HTMLElement).getAllByRole('textbox')[1], { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));
  fireEvent.click(within(destination).getByRole('button', { name: /VOLVER A CONTROL/ }));
  expect(screen.getByText(/Cliente: LAB-B/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Cliente ficticio'), { target: { value: 'LAB-A' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[0]);
  expect(screen.getByRole('region', { name: 'Vista funcional del KPI' })).toHaveTextContent('Realizado: 3');
});

test('weekly control target retains week and a discarded checklist draft does not persist', () => {
  render(<ControlVisualLab />);
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'GESTIÓN DETALLADA DE ACTIVIDADES' }));
  const firstActivity = screen.getByText('Actividad de prueba A').closest('.group');
  fireEvent.change(within(firstActivity as HTMLElement).getAllByRole('textbox')[1], { target: { value: '5' } });
  fireEvent.click(screen.getByTitle('Cerrar'));
  fireEvent.click(within(screen.getByRole('region', { name: 'Vista funcional del KPI' })).getByRole('button', { name: /VOLVER A CONTROL/ }));
  expect(screen.getAllByRole('button', { name: 'GESTIONAR' })[0].closest('article')).toHaveTextContent('Realizado: 3');
  fireEvent.change(screen.getByLabelText('Cliente ficticio'), { target: { value: 'LAB-B' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[1]);
  expect(screen.getByRole('region', { name: 'Vista funcional del KPI' })).toHaveTextContent('KPI ID: 1021 · Período: Semana 39 2026');
});

test('CONTROL category filter survives navigation and return in the same client', () => {
  render(<ControlVisualLab />);
  fireEvent.change(screen.getByLabelText('Filtrar pendientes por categoría'), { target: { value: 'RESULTADO' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /VOLVER A CONTROL/ }));
  expect(screen.getByLabelText('Filtrar pendientes por categoría')).toHaveValue('RESULTADO');
});
