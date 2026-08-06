/**
 * Tests focalizados: AggregateBuilder y FormulaBuilder — portal a document.body (v9.4.20)
 *
 * Verifica:
 * 10. AggregateBuilder y FormulaBuilder se renderizan en document.body (portal)
 * 11. Cierre por X, Escape y backdrop
 * 12. Desmontaje limpia listeners y scroll lock
 * 13. Abrir, cerrar y reabrir no deja overlay residual
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AggregateBuilder } from './AggregateBuilder';
import { FormulaBuilder } from './FormulaBuilder';
import { DashboardItem } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeItem = (id: number | string, extra: Partial<DashboardItem> = {}): DashboardItem =>
  ({
    id,
    indicator: `Indicador ${id}`,
    indicatorType: 'compound',
    componentIds: [],
    type: 'average',
    goalType: 'maximize',
    unit: '%',
    weight: 0,
    monthlyProgress: Array(12).fill(0),
    monthlyGoals: Array(12).fill(0),
    ...extra,
  } as unknown as DashboardItem);

const makeFormulaItem = (id: number | string): DashboardItem =>
  ({
    id,
    indicator: `Formula ${id}`,
    indicatorType: 'formula',
    formula: '',
    type: 'average',
    goalType: 'maximize',
    unit: '%',
    weight: 0,
    monthlyProgress: Array(12).fill(0),
    monthlyGoals: Array(12).fill(0),
  } as unknown as DashboardItem);

const source1 = makeItem(1, { indicatorType: 'simple' as any });
const source2 = makeItem(2, { indicatorType: 'simple' as any });
const currentAggregate = makeItem(99, { componentIds: [1, 2] });
const allItems = [source1, source2, currentAggregate];

// ── AggregateBuilder ──────────────────────────────────────────────────────────

describe('AggregateBuilder — Portal a document.body (v9.4.20)', () => {

  // Test 10a: se renderiza en document.body
  test('10a. el overlay del modal se monta directamente en document.body', () => {
    const { baseElement } = render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // El overlay fixed debe estar en body, no dentro del container de prueba (el div raíz que RTL crea)
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    // En portal, el padre directo del overlay es document.body
    expect(overlay?.parentElement).toBe(document.body);
    // Verificación adicional: el overlay NO debe ser hijo del div-container que RTL crea dentro de body
    // (RTL crea un <div> dentro de body como container; el portal salta directamente a body)
    const rtlContainer = baseElement.firstElementChild;
    if (rtlContainer) {
      expect(rtlContainer.contains(overlay)).toBe(false);
    }
  });

  // Test 11a: cierre por X
  test('11a. cierre por botón X llama onClose', () => {
    const onClose = jest.fn();
    render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={onClose}
      />
    );
    const closeBtn = screen.getByTitle('Cerrar modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 11b: cierre por Escape
  test('11b. cierre por tecla Escape llama onClose', () => {
    const onClose = jest.fn();
    render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 11c: cierre por backdrop
  test('11c. cierre por clic en backdrop llama onClose', () => {
    const onClose = jest.fn();
    render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={onClose}
      />
    );
    const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 12: desmontaje limpia scroll lock
  test('12. al desmontar, body.style.overflow vuelve al valor original', () => {
    const original = document.body.style.overflow;
    const { unmount } = render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // Mientras montado, debe estar bloqueado
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    // Después del desmontaje debe restaurarse
    expect(document.body.style.overflow).toBe(original);
  });

  // Test 13: abrir, cerrar y reabrir no deja overlay residual
  test('13. abrir, cerrar y reabrir: no queda overlay residual del ciclo anterior', () => {
    const { unmount } = render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(document.querySelectorAll('.fixed.inset-0').length).toBe(1);
    unmount();
    expect(document.querySelectorAll('.fixed.inset-0').length).toBe(0);

    // Re-abrir
    const { unmount: unmount2 } = render(
      <AggregateBuilder
        currentItem={currentAggregate}
        allItems={allItems}
        onChangeComponentIds={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(document.querySelectorAll('.fixed.inset-0').length).toBe(1);
    unmount2();
    expect(document.querySelectorAll('.fixed.inset-0').length).toBe(0);
  });
});

// ── FormulaBuilder ────────────────────────────────────────────────────────────

describe('FormulaBuilder — Portal a document.body (v9.4.20)', () => {
  const formulaItem = makeFormulaItem(88);
  const formulaAllItems = [makeItem(1, { indicatorType: 'simple' as any }), formulaItem];

  // Test 10b: FormulaBuilder se renderiza en document.body
  test('10b. el overlay de FormulaBuilder se monta directamente en document.body', () => {
    const { baseElement } = render(
      <FormulaBuilder
        currentItem={formulaItem}
        allItems={formulaAllItems}
        onChangeFormula={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    expect(overlay?.parentElement).toBe(document.body);
    // El overlay NO debe ser hijo del div-container interno que RTL crea
    const rtlContainer = baseElement.firstElementChild;
    if (rtlContainer) {
      expect(rtlContainer.contains(overlay)).toBe(false);
    }
  });

  // Test 11d: cierre por X en FormulaBuilder
  test('11d. cierre por botón X en FormulaBuilder llama onClose', () => {
    const onClose = jest.fn();
    render(
      <FormulaBuilder
        currentItem={formulaItem}
        allItems={formulaAllItems}
        onChangeFormula={jest.fn()}
        onClose={onClose}
      />
    );
    const closeBtn = screen.getByTitle('Cerrar modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 11e: cierre por backdrop en FormulaBuilder
  test('11e. cierre por clic en backdrop de FormulaBuilder llama onClose', () => {
    const onClose = jest.fn();
    render(
      <FormulaBuilder
        currentItem={formulaItem}
        allItems={formulaAllItems}
        onChangeFormula={jest.fn()}
        onClose={onClose}
      />
    );
    const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 12b: desmontaje FormulaBuilder limpia scroll
  test('12b. al desmontar FormulaBuilder, body.style.overflow vuelve al valor original', () => {
    const original = document.body.style.overflow;
    const { unmount } = render(
      <FormulaBuilder
        currentItem={formulaItem}
        allItems={formulaAllItems}
        onChangeFormula={jest.fn()}
        onClose={jest.fn()}
      />
    );
    unmount();
    expect(document.body.style.overflow).toBe(original);
  });
});
