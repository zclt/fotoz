import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

import { App } from './App';

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Hello World' } }),
  },
}));

vi.mock('react-webcam', async () => ({
  default: React.forwardRef(function MockWebcam(
    _props: Record<string, unknown>,
    ref: React.Ref<{ getScreenshot: () => string }>
  ) {
    React.useImperativeHandle(ref, () => ({
      getScreenshot: () => 'data:image/png;base64,mockimage',
    }));
    return React.createElement('video', { 'data-testid': 'webcam' });
  }),
}));

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'device-1', label: 'Camera 1' },
      ]),
    },
    configurable: true,
    writable: true,
  });
  vi.clearAllMocks();
});

describe('App', () => {
  it('renderiza sem câmera visível por padrão', () => {
    render(<App />);
    expect(screen.queryByTestId('webcam')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mostrar/ })).toBeInTheDocument();
  });

  it('exibe a câmera ao clicar em Mostrar', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));

    expect(screen.getByTestId('webcam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Esconder/ })).toBeInTheDocument();
  });

  it('esconde a câmera ao clicar em Esconder', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    await user.click(screen.getByRole('button', { name: /Esconder/ }));

    expect(screen.queryByTestId('webcam')).not.toBeInTheDocument();
  });

  it('Snapshot está desabilitado quando câmera está oculta', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Snapshot/ })).toBeDisabled();
  });

  it('Snapshot está habilitado quando câmera está visível', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));

    expect(screen.getByRole('button', { name: /Snapshot/ })).not.toBeDisabled();
  });

  it('executa OCR ao capturar e exibe o texto reconhecido', async () => {
    const Tesseract = (await import('tesseract.js')).default;
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    await user.click(screen.getByRole('button', { name: /Snapshot/ }));

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    expect(Tesseract.recognize).toHaveBeenCalledWith(
      'data:image/png;base64,mockimage',
      'eng'
    );
  });

  it('exibe mensagem de erro quando OCR falha', async () => {
    const Tesseract = (await import('tesseract.js')).default;
    vi.mocked(Tesseract.recognize).mockRejectedValueOnce(new Error('OCR error'));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    await user.click(screen.getByRole('button', { name: /Snapshot/ }));

    await waitFor(() => {
      expect(screen.getByText(/Falha ao processar imagem/)).toBeInTheDocument();
    });
  });

  it('"Alternar câmera" está desabilitado quando câmera está oculta', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Alternar/ })).toBeDisabled();
  });

  it('painel de controle exibe status inicial AGUARDANDO', () => {
    render(<App />);
    expect(screen.getByText('AGUARDANDO')).toBeInTheDocument();
  });

  it('painel de controle exibe contador LED zerado', () => {
    render(<App />);
    expect(screen.getByText('0000')).toBeInTheDocument();
  });

  it('contador incrementa após captura bem-sucedida', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    await user.click(screen.getByRole('button', { name: /Snapshot/ }));

    await waitFor(() => {
      expect(screen.getByText('0001')).toBeInTheDocument();
    });
  });
});
