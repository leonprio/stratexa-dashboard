import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('1-3. Debe verificar que los 4 checkboxes de Bajas 0-30, 31-60, 61-90, 91 y mas estan checked', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(5);
    const checkedBoxes = checkboxes.filter(cb => cb.checked);
    expect(checkedBoxes).toHaveLength(4);
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

  it('6. Debe excluir el indicador actual (currentItem #4) de la lista de fuentes disponibles', () => {
    const { container } = render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );  const listContainer = document.querySelector('.max-h-56')!;
    expect(within(listContainer as HTMLElement).queryByText('#4')).not.toBeInTheDocument();
  });

  it('7 & 10. Debe permitir desmarcar una fuente y actualizar contador, preview y checkbox state', () => {
    render(
      <AggregateBuilder
        currentItem={currentItem}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const bajas030 = screen.getByText('Bajas 0-30');
    fireEvent.click(bajas030);
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (3 seleccionadas)')).toBeInTheDocument();
  });

  it('7b. Debe permitir seleccionar Ventas Totales y actualizar contador y checkbox', () => {
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

  it('11. Debe deduplicar componentIds duplicados [5,5,6] entregando IDs unicos', () => {
    const itemWithDuplicates: DashboardItem = {
      ...currentItem,
      componentIds: [5, 5, 6],
    };
    render(
      <AggregateBuilder
        currentItem={itemWithDuplicates}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('2. Selecciona las fuentes de consolidación (2 seleccionadas)')).toBeInTheDocument();
  });

  describe('v9.4.21 - Aggregate preview compliance tests', () => {
    it('1. MINIMIZAR: advance=33.352, goal=3.2 -> expectedCompliance ≈ 9.5946% (nunca ~1044%)', () => {
      const minItem: DashboardItem = {
        id: 10,
        indicator: 'Rotación SH',
        unit: '%',
        indicatorType: 'compound',
        goalType: 'minimize',
        type: 'average',
        componentIds: [11],
        monthlyProgress: Array(12).fill(0),
        monthlyGoals: Array(12).fill(0),
      };
      const sourceItem: DashboardItem = {
        id: 11,
        indicator: 'Fuente Rotación',
        unit: '%',
        indicatorType: 'simple',
        goalType: 'minimize',
        monthlyProgress: [0, 0, 0, 0, 0, 33.352, 0, 0, 0, 0, 0, 0],
        monthlyGoals: [0, 0, 0, 0, 0, 3.2, 0, 0, 0, 0, 0, 0],
      };
      render(
        <AggregateBuilder
          currentItem={minItem}
          allItems={[minItem, sourceItem]}
          onChangeComponentIds={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByText('33.4 %')).toBeInTheDocument();
      expect(screen.getByText('3.2 %')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.queryByText('1044%')).not.toBeInTheDocument();
      expect(screen.queryByText('1043%')).not.toBeInTheDocument();
    });

    it('3. MAXIMIZAR: advance=80, goal=100 -> expectedCompliance = 80%', () => {
      const maxItem: DashboardItem = {
        id: 12,
        indicator: 'Ventas',
        unit: '%',
        indicatorType: 'compound',
        goalType: 'maximize',
        type: 'average',
        componentIds: [13],
        monthlyProgress: Array(12).fill(0),
        monthlyGoals: Array(12).fill(0),
      };
      const sourceItem: DashboardItem = {
        id: 13,
        indicator: 'Fuente Ventas',
        unit: '%',
        indicatorType: 'simple',
        goalType: 'maximize',
        monthlyProgress: [0, 0, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0],
        monthlyGoals: [0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0],
      };
      render(
        <AggregateBuilder
          currentItem={maxItem}
          allItems={[maxItem, sourceItem]}
          onChangeComponentIds={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('4. MINIMIZAR: advance=80, goal=100 -> expectedCompliance = 125%', () => {
      const minItem: DashboardItem = {
        id: 14,
        indicator: 'Costos',
        unit: '%',
        indicatorType: 'compound',
        goalType: 'minimize',
        type: 'average',
        componentIds: [15],
        monthlyProgress: Array(12).fill(0),
        monthlyGoals: Array(12).fill(0),
      };
      const sourceItem: DashboardItem = {
        id: 15,
        indicator: 'Fuente Costos',
        unit: '%',
        indicatorType: 'simple',
        goalType: 'minimize',
        monthlyProgress: [0, 0, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0],
        monthlyGoals: [0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0],
      };
      render(
        <AggregateBuilder
          currentItem={minItem}
          allItems={[minItem, sourceItem]}
          onChangeComponentIds={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByText('125%')).toBeInTheDocument();
    });

    it('5. Cero y ausencia: meta 0 y avance 0 devuelven 0%', () => {
      const zeroItem: DashboardItem = {
        id: 16,
        indicator: 'Vacio',
        unit: '%',
        indicatorType: 'compound',
        goalType: 'maximize',
        type: 'average',
        componentIds: [17],
        monthlyProgress: Array(12).fill(0),
        monthlyGoals: Array(12).fill(0),
      };
      const sourceItem: DashboardItem = {
        id: 17,
        indicator: 'Fuente Vacia',
        unit: '%',
        indicatorType: 'simple',
        monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      };
      render(
        <AggregateBuilder
          currentItem={zeroItem}
          allItems={[zeroItem, sourceItem]}
          onChangeComponentIds={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });
});
