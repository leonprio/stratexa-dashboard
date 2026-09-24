
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActivityManager } from './ActivityManager';
import { Activity } from '../types';

// Mock de actividades usando el esquema real (label e IDs como strings)
const mockActivities: Activity[] = [
    { id: '1', label: 'Actividad 1', completedCount: 0, targetCount: 1 },
    { id: '2', label: 'Actividad 2', completedCount: 1, targetCount: 1 },
];

describe('ActivityManager Component v9.2.2', () => {
    const mockOnSave = jest.fn();
    const mockOnClose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('debe renderizar el título y subtítulo correctamente', () => {
        render(
            <ActivityManager
                title="Tablero de Prueba"
                subtitle="Enero 2026"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('Tablero de Prueba')).toBeInTheDocument();
        expect(screen.getByText('Enero 2026')).toBeInTheDocument();
    });

    it('debe listar las actividades iniciales como texto', () => {
        render(
            <ActivityManager
                title="Test"
                subtitle="Test"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
            />
        );

        expect(screen.getByText('Actividad 1')).toBeInTheDocument();
        expect(screen.getByText('Actividad 2')).toBeInTheDocument();
    });

    it('debe permitir agregar un nuevo elemento', () => {
        render(
            <ActivityManager
                title="Test"
                subtitle="Test"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
            />
        );

        const input = screen.getByPlaceholderText(/NOMBRE \(EJ: GENERAL, SERVICIOS\.\.\.\)/i);
        fireEvent.change(input, { target: { value: 'Nueva Actividad' } });
        
        const addButton = screen.getByText(/AÑADIR ELEMENTO/i);
        fireEvent.click(addButton);

        expect(screen.getByText('Nueva Actividad')).toBeInTheDocument();
    });

    it('debe llamar a onSave con la lista de actividades al confirmar', () => {
        render(
            <ActivityManager
                title="Test"
                subtitle="Test"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
            />
        );

        const saveButton = screen.getByText(/CONFIRMAR LISTA/i);
        fireEvent.click(saveButton);

        expect(mockOnSave).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ label: 'Actividad 1' }),
            expect.objectContaining({ label: 'Actividad 2' })
        ]));
    });

    it('debe llamar a onClose al presionar el botón de cerrar', () => {
        render(
            <ActivityManager
                title="Test"
                subtitle="Test"
                initialActivities={mockActivities}
                onSave={mockOnSave}
                onClose={mockOnClose}
            />
        );

        const closeButton = screen.getByTitle('Cerrar');
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('oculta la importación a usuarios de solo lectura', () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} canEdit={false} />);
        expect(screen.queryByText('IMPORTAR ELEMENTOS')).not.toBeInTheDocument();
    });

    it('muestra la vista previa y agrega únicamente elementos nuevos tras confirmar', async () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('IMPORTAR ELEMENTOS'));
        const file = new File(['elemento\nActividad 1\nNueva Uno\nNueva Uno\nNueva Dos'], 'elementos.csv', { type: 'text/csv' });
        fireEvent.change(screen.getByLabelText('Seleccionar archivo CSV'), { target: { files: [file] } });

        expect(await screen.findByText('Filas leídas')).toBeInTheDocument();
        expect(screen.getByText('CONFIRMAR IMPORTACIÓN')).toBeEnabled();
        fireEvent.click(screen.getByText('CONFIRMAR IMPORTACIÓN'));

        expect(screen.getByText('Nueva Uno')).toBeInTheDocument();
        expect(screen.getByText('Nueva Dos')).toBeInTheDocument();
        fireEvent.click(screen.getByText('CONFIRMAR LISTA'));
        expect(mockOnSave).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ label: 'Actividad 1', id: '1' }),
            expect.objectContaining({ label: 'Nueva Uno', targetCount: 1, completedCount: 0 }),
            expect.objectContaining({ label: 'Nueva Dos', targetCount: 1, completedCount: 0 }),
        ]));
    });
});
