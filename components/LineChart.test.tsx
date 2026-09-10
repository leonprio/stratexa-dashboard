import { render, screen } from '@testing-library/react';
import { LineChart } from './LineChart';

const props = {
  unit: 'unidades', type: 'average' as const, status: 'OnTrack' as const,
  progressData: [null, null, null, null, null, null, null, 5, null, null, null, null],
  goalData: [null, null, null, null, null, null, null, 20, null, null, null, null],
  capturedData: [false, false, false, false, false, false, false, true],
  goalDefinedData: [false, false, false, false, false, false, false, true],
};

describe('LineChart gaps semánticos', () => {
  test('no renderiza puntos antes de agosto y comienza en agosto', () => {
    render(<LineChart {...props} />);
    expect(screen.queryByLabelText(/Periodo Ene: Real/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Periodo Jul: Real/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Periodo Ago: Real 5')).toBeInTheDocument();
  });
  test('renderiza el cero explícitamente capturado', () => {
    render(<LineChart {...props} progressData={[null, null, null, null, null, null, null, 0]} />);
    expect(screen.getByLabelText('Periodo Ago: Real 0')).toBeInTheDocument();
  });
});
