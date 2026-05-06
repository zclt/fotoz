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
  localStorage.clear();
  vi.clearAllMocks();
});

describe('App — câmera e controles', () => {
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

  it('"Alternar câmera" está desabilitado quando câmera está oculta', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Alternar/ })).toBeDisabled();
  });
});

describe('App — OCR com Tesseract (padrão)', () => {
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
      expect(screen.getByText(/OCR error/)).toBeInTheDocument();
    });
  });
});

describe('App — painel de controle', () => {
  it('exibe status inicial AGUARDANDO', () => {
    render(<App />);
    expect(screen.getByText('AGUARDANDO')).toBeInTheDocument();
  });

  it('exibe contador LED zerado', () => {
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

describe('App — seletor de engine OCR', () => {
  it('renderiza as três opções de engine', () => {
    render(<App />);
    expect(screen.getByRole('radio', { name: /Tesseract/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Google Vision/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Claude/i })).toBeInTheDocument();
  });

  it('Tesseract está selecionado por padrão', () => {
    render(<App />);
    expect(screen.getByRole('radio', { name: /Tesseract/i })).toBeChecked();
  });

  it('não exibe campo de API Key com Tesseract selecionado', () => {
    render(<App />);
    expect(screen.queryByPlaceholderText(/Cole sua chave/i)).not.toBeInTheDocument();
  });

  it('exibe campo de API Key ao selecionar Google Vision', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Google Vision/i }));

    expect(screen.getByPlaceholderText(/Cole sua chave/i)).toBeInTheDocument();
  });

  it('exibe campo de API Key ao selecionar Claude', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Claude/i }));

    expect(screen.getByPlaceholderText(/Cole sua chave/i)).toBeInTheDocument();
  });

  it('persiste a engine selecionada no localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Google Vision/i }));

    expect(localStorage.getItem('fotoz-engine')).toBe('google-vision');
  });

  it('persiste a API Key no localStorage por engine', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Claude/i }));
    await user.type(screen.getByPlaceholderText(/Cole sua chave/i), 'sk-test-key');

    expect(localStorage.getItem('fotoz-key-claude')).toBe('sk-test-key');
  });

  it('exibe erro ao capturar com engine de nuvem sem API Key', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('radio', { name: /Google Vision/i }));
    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    await user.click(screen.getByRole('button', { name: /Snapshot/ }));

    await waitFor(() => {
      expect(screen.getByText(/API Key obrigatória/i)).toBeInTheDocument();
    });
  });
});
