
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

    it('conserva el realizado editado al confirmar la lista', () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} />);
        fireEvent.change(screen.getAllByDisplayValue('0')[0], { target: { value: '2' } });
        fireEvent.click(screen.getByText('CONFIRMAR LISTA'));
        expect(mockOnSave).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: '1', completedCount: 2, targetCount: 1 }),
        ]));
    });

    it('oculta la importación a usuarios de solo lectura', () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} canEdit={false} />);
        expect(screen.queryByText('IMPORTAR ELEMENTOS')).not.toBeInTheDocument();
    });

    it('muestra la vista previa y agrega únicamente elementos nuevos tras confirmar', async () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('IMPORTAR ELEMENTOS'));
        const file = new File(['elemento,meta\nActividad 1,1\nNueva Uno,2\nNueva Uno,2\nNueva Dos,3'], 'elementos.csv', { type: 'text/csv' });
        fireEvent.change(screen.getByLabelText('Seleccionar archivo CSV'), { target: { files: [file] } });

        expect(await screen.findByText('Filas leídas')).toBeInTheDocument();
        expect(screen.getByText('CONFIRMAR IMPORTACIÓN')).toBeEnabled();
        fireEvent.click(screen.getByText('CONFIRMAR IMPORTACIÓN'));

        expect(screen.getByText('Nueva Uno')).toBeInTheDocument();
        expect(screen.getByText('Nueva Dos')).toBeInTheDocument();
        fireEvent.click(screen.getByText('CONFIRMAR LISTA'));
        expect(mockOnSave).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ label: 'Actividad 1', id: '1' }),
            expect.objectContaining({ label: 'Nueva Uno', targetCount: 2, completedCount: 0 }),
            expect.objectContaining({ label: 'Nueva Dos', targetCount: 3, completedCount: 0 }),
        ]));
    });

    it('muestra y aplica una actualización de meta sin reemplazar el elemento existente', async () => {
        render(<ActivityManager title="Test" initialActivities={mockActivities} onSave={mockOnSave} onClose={mockOnClose} />);
        fireEvent.click(screen.getByText('IMPORTAR ELEMENTOS'));
        fireEvent.click(screen.getByText('AGREGAR Y ACTUALIZAR METAS'));
        const file = new File(['elemento,meta\nActividad 1,3\nActividad 2,1'], 'metas.csv', { type: 'text/csv' });
        fireEvent.change(screen.getByLabelText('Seleccionar archivo CSV'), { target: { files: [file] } });
        expect(await screen.findByText('Vista previa de actualización')).toBeInTheDocument();
        expect(screen.getByText('Meta actual')).toBeInTheDocument();
        expect(screen.getByText('Meta propuesta')).toBeInTheDocument();
        fireEvent.click(screen.getByText('CONFIRMAR IMPORTACIÓN'));
        fireEvent.click(screen.getByText('CONFIRMAR LISTA'));
        expect(mockOnSave).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: '1', label: 'Actividad 1', targetCount: 3, completedCount: 0 }),
            expect.objectContaining({ id: '2', label: 'Actividad 2', targetCount: 1, completedCount: 1 }),
        ]));
    });
});
