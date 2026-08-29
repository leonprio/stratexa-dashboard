import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActionPlan } from './ActionPlan';

describe('legacy paiRows history viewer', () => {
  const props = { status: 'AtRisk' as const, onSave: jest.fn(), canEdit: true };
  it('renders no legacy block or capture CTA when paiRows is empty', () => {
    render(<ActionPlan {...props} initialRows={[]} />);
    expect(screen.queryByText('Histórico de acciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Guardar Itinerario')).not.toBeInTheDocument();
    expect(screen.queryByText('Iniciar Plan de Acción')).not.toBeInTheDocument();
  });
  it('renders historical values read-only without legacy actions', () => {
    render(<ActionPlan {...props} initialRows={[{ action: 'Recuperar ventas', date: '2026-03-15', result: 'Campaña activa', impact: 'positive' }]} />);
    expect(screen.getByText('Histórico de acciones')).toBeInTheDocument();
    expect(screen.getByText('Recuperar ventas')).toBeInTheDocument();
    expect(screen.getByText('Campaña activa')).toBeInTheDocument();
    expect(screen.queryByText('Agregar Acción')).not.toBeInTheDocument();
    expect(screen.queryByText('Guardar Itinerario')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
