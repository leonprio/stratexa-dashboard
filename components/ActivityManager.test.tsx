import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ActivityManager } from './ActivityManager';

const mockActivities = [
    { id: '1', label: 'Actividad 1', targetCount: 10, completedCount: 5 },
    { id: '2', label: 'Actividad 2', targetCount: 5, completedCount: 5 },
];

const mockOnSave = jest.fn();
const mockOnClose = jest.fn();

describe('ActivityManager Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('debe renderizar la lista de actividades', () => {
        render(
            <ActivityManager
                periodLabel="Enero 2026"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
                canEdit={true}
            />
        );

        expect(screen.getByText(/Gestión de Actividades - Enero 2026/i)).toBeInTheDocument();
        expect(screen.getByText('Actividad 1')).toBeInTheDocument();
        expect(screen.getByText('Actividad 2')).toBeInTheDocument();
    });

    test('debe permitir actualizar el conteo realizado', () => {
        render(
            <ActivityManager
                periodLabel="Enero"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
                canEdit={true}
            />
        );

        const inputs = screen.getAllByLabelText(/Cantidad realizada de/i);
        fireEvent.change(inputs[0], { target: { value: '7' } });

        expect(inputs[0]).toHaveValue(7);
    });

    test('debe permitir el modo de carga masiva', () => {
        render(
            <ActivityManager
                periodLabel="Enero"
                initialActivities={[]}
                onSave={mockOnSave}
                onClose={mockOnClose}
                canEdit={true}
            />
        );

        const bulkBtn = screen.getByText(/Carga Masiva/i);
        fireEvent.click(bulkBtn);

        const textarea = screen.getByLabelText(/Lista de metas/i);
        fireEvent.change(textarea, { target: { value: 'Nueva Meta 1\nNueva Meta 2' } });

        const addBtn = screen.getByText(/Añadir Metas a la Lista/i);
        fireEvent.click(addBtn);

        expect(screen.getByText('Nueva Meta 1')).toBeInTheDocument();
        expect(screen.getByText('Nueva Meta 2')).toBeInTheDocument();
    });

    test('debe llamar a onSave al hacer clic en guardar ahora', () => {
        render(
            <ActivityManager
                periodLabel="Enero"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
                canEdit={true}
            />
        );

        const saveButtons = screen.getAllByText(/GUARDAR CAMBIOS/i);
        fireEvent.click(saveButtons[0]);

        expect(mockOnSave).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
    });
});
