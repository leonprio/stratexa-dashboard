import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AggregateBuilder } from './AggregateBuilder';
import { DashboardItem } from '../types';

describe('AggregateBuilder Component (v9.4.15 Contract)', () => {
  const currentItem: DashboardItem = {
    id: 4,
    indicator: 'Bajas Totales',
    unit: 'Personas',
    indicatorType: 'compound',
    type: 'accumulative',
    componentIds: [5, 6, 7, 8],
    monthlyProgress: Array(12).fill(0),
    monthlyGoals: Array(12).fill(0),
  };

  const allItems: DashboardItem[] = [
    currentItem,
    {
      id: 5,
      indicator: 'Bajas 0-30',
      unit: 'Personas',
      indicatorType: 'simple',
      monthlyProgress: [10, 10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [12, 12, 12, 12, 12, 12, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 6,
      indicator: 'Bajas 31-60',
      unit: 'Personas',
      indicatorType: 'simple',
      monthlyProgress: [5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 7,
      indicator: 'Bajas 61-90',
      unit: 'Personas',
      indicatorType: 'simple',
      monthlyProgress: [2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 8,
      indicator: 'Bajas 91 y más',
      unit: 'Personas',
      indicatorType: 'simple',
      monthlyProgress: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 9,
      indicator: 'Ventas Totales',
      unit: 'Pesos',
      indicatorType: 'simple',
      monthlyProgress: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [120, 120, 120, 120, 120, 120, 0, 0, 0, 0, 0, 0],
    },
  ];

  it('1-3. Debe mostrar fuentes Bajas 0-30, 31-60, 61-90, 91 y mas marcadas', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Bajas 0-30')).toBeInTheDocument();
    expect(screen.getByText('Bajas 31-60')).toBeInTheDocument();
    expect(screen.getByText('Bajas 61-90')).toBeInTheDocument();
    expect(screen.getByText('Bajas 91 y más')).toBeInTheDocument();
  });

  it('4. Debe mostrar el contador en 4 seleccionadas', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (4 seleccionadas)')).toBeInTheDocument();
  });

  it('5. Debe calcular preview con las 4 fuentes', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('18 Personas')).toBeInTheDocument();
    expect(screen.getByText('23 Personas')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('6. Debe excluir el indicador actual de la lista', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByText('#4')).not.toBeInTheDocument();
  });

  it('7 & 10. Debe permitir seleccion manual sin ocultar fuentes', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const ventasOption = screen.getByText('Ventas Totales');
    fireEvent.click(ventasOption);
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (5 seleccionadas)')).toBeInTheDocument();
  });

  it('8. Debe bloquear Aplicar si existen IDs huerfanos', () => {
    const itemWithOrphan: DashboardItem = {
      ...currentItem,
      componentIds: [5, 999],
    };
    render(
      <AggregateBuilder
        currentItem={itemWithOrphan}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/FUENTES HUÉRFANAS DETECTADAS/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar Agregado/i })).toBeDisabled();
  });

  it('9. Debe resincronizar al cambiar currentItem', () => {
    const { rerender } = render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (4 seleccionadas)')).toBeInTheDocument();
    const newItem: DashboardItem = {
      id: 9,
      indicator: 'Ventas Totales',
      unit: 'Pesos',
      indicatorType: 'compound',
      type: 'accumulative',
      componentIds: [5],
      monthlyProgress: Array(12).fill(0),
      monthlyGoals: Array(12).fill(0),
    };
    rerender(
      <AggregateBuilder
        currentItem={newItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (1 seleccionadas)')).toBeInTheDocument();
  });
});
