import React from 'react';
import Webcam from 'react-webcam';

import { OcrEngine, ENGINE_META, runOcr } from './ocr';
import './style.css';

type CapturedImage = { base64: string; texto: string; engine: OcrEngine };
type OcrStatus = 'idle' | 'processing' | 'success' | 'error';

const STATUS_LABEL: Record<OcrStatus, string> = {
  idle: 'AGUARDANDO',
  processing: 'PROCESSANDO...',
  success: 'CONCLUÍDO',
  error: 'ERRO',
};

const ENGINES: OcrEngine[] = ['tesseract', 'google-vision', 'claude'];

function loadKey(engine: OcrEngine): string {
  return localStorage.getItem(`fotoz-key-${engine}`) ?? '';
}

function saveKey(engine: OcrEngine, key: string) {
  localStorage.setItem(`fotoz-key-${engine}`, key);
}

export const App = () => {
  const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
  const [deviceLabel, setDeviceLabel] = React.useState('Nenhum detectado');
  const [imgs, setImgs] = React.useState<CapturedImage[]>([]);
  const [rearCamera, setRearCamera] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = React.useState<OcrStatus>('idle');
  const [lastOcrTime, setLastOcrTime] = React.useState('--:--:--');
  const [lastCharCount, setLastCharCount] = React.useState(0);

  const [engine, setEngine] = React.useState<OcrEngine>(
    () => (localStorage.getItem('fotoz-engine') as OcrEngine | null) ?? 'tesseract'
  );
  const [apiKey, setApiKey] = React.useState(() => loadKey(engine));

  const webcamRef = React.useRef<Webcam>(null);

  const handleEngineChange = (next: OcrEngine) => {
    setEngine(next);
    localStorage.setItem('fotoz-engine', next);
    setApiKey(loadKey(next));
    setError(null);
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    saveKey(engine, key);
  };

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setProcessing(true);
    setOcrStatus('processing');
    setError(null);

    const activeKey = loadKey(engine);

    runOcr(engine, imageSrc, activeKey || undefined)
      .then((text) => {
        setImgs(prev => [...prev, { texto: text, base64: imageSrc, engine }]);
        setLastOcrTime(new Date().toLocaleTimeString('pt-BR'));
        setLastCharCount(text.trim().length);
        setOcrStatus('success');
      })
      .catch((err: Error) => {
        setError(`ERRO: ${err.message}`);
        setOcrStatus('error');
      })
      .finally(() => setProcessing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const handleDevices = React.useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevice = mediaDevices.find(({ kind }) => kind === 'videoinput');
    setDeviceId(videoDevice?.deviceId);
    setDeviceLabel(videoDevice?.label || 'Camera #1');
  }, []);

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  const meta = ENGINE_META[engine];

  return (
    <div className="desktop">

      <div className="marquee-bar">
        <div className="marquee-text">
          ★ FOTOZ v1.0 ★ POWERED BY TESSERACT.JS WASM ★ GOOGLE VISION API ★ CLAUDE HAIKU ★ OCR TECHNOLOGY FOR THE WEB ★ CAPTURE • RECOGNIZE • DISPLAY ★ FOTOZ v1.0 ★
        </div>
      </div>

      <div className="window">
        <div className="title-bar">
          <span className="title-bar-text">📷 FOTOZ — OCR Vision System v1.0</span>
          <div className="title-bar-controls">
            <button className="title-btn">_</button>
            <button className="title-btn">□</button>
            <button className="title-btn">✕</button>
          </div>
        </div>

        <div className="menu-bar">
          <span className="menu-item">Arquivo</span>
          <span className="menu-item">Câmera</span>
          <span className="menu-item">OCR</span>
          <span className="menu-item">Ajuda</span>
        </div>

        <div className="toolbar">
          <button className="win-btn" onClick={() => setVisible(v => !v)}>
            {visible ? '⏹ Esconder' : '▶ Mostrar'}
          </button>
          <div className="toolbar-sep" />
          <button className="win-btn" onClick={() => setRearCamera(c => !c)} disabled={!visible}>
            🔄 Alternar câmera
          </button>
          <div className="toolbar-sep" />
          <button className="win-btn capture-btn" onClick={capture} disabled={!visible || processing}>
            {processing ? '⌛ Processando...' : '📸 Snapshot'}
          </button>
          <div className="toolbar-sep" />
          <span className="toolbar-engine-badge badge-{engine}">
            <span className={`engine-badge badge-${engine}`}>{meta.badge}</span>
            {meta.label}
          </span>
        </div>

        {error && <div className="error-bar">{error}</div>}

        <div className="window-body">

          <div className="camera-section">
            <div className="panel">
              <div className="panel-title">◉ CÂMERA AO VIVO</div>
              <div className="camera-view">
                {visible ? (
                  <Webcam
                    ref={webcamRef}
                    id="webcam"
                    audio={false}
                    screenshotQuality={1}
                    screenshotFormat="image/png"
                    videoConstraints={{
                      width: 400,
                      deviceId,
                      facingMode: rearCamera ? 'environment' : 'user',
                    }}
                    forceScreenshotSourceSize
                    onDoubleClick={capture}
                  />
                ) : (
                  <div className="no-signal">
                    <div className="no-signal-text">SEM SINAL</div>
                    <div className="no-signal-sub">clique em ▶ Mostrar para ativar</div>
                  </div>
                )}
              </div>
              {processing && (
                <div className="progress-wrap">
                  <div className="progress-label">⌛ PROCESSANDO OCR [{meta.label}]...</div>
                  <div className="progress-bar">
                    <div className="progress-fill" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar">

            <div className="panel">
              <div className="panel-title">◈ PAINEL DE CONTROLE</div>
              <table className="info-table">
                <tbody>
                  <tr>
                    <td className="info-key">STATUS</td>
                    <td>
                      <span className={`status-dot status-${ocrStatus}`} />
                      <span className={`status-text status-text-${ocrStatus}`}>
                        {STATUS_LABEL[ocrStatus]}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="info-key">CAPTURAS</td>
                    <td>
                      <span className="led-counter">
                        {String(imgs.length).padStart(4, '0')}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="info-key">ÚLTIMO OCR</td>
                    <td className="info-val">{lastOcrTime}</td>
                  </tr>
                  <tr>
                    <td className="info-key">CHARS</td>
                    <td className="info-val">{lastCharCount}</td>
                  </tr>
                  <tr>
                    <td className="info-key">DISPOSITIVO</td>
                    <td className="info-val device-label">{deviceLabel}</td>
                  </tr>
                  <tr>
                    <td className="info-key">MOTOR</td>
                    <td className="info-val">{meta.label}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-title">⚙ MOTOR OCR</div>
              <div className="engine-selector">
                {ENGINES.map(eng => (
                  <label key={eng} className="radio-label">
                    <input
                      type="radio"
                      name="engine"
                      value={eng}
                      checked={engine === eng}
                      onChange={() => handleEngineChange(eng)}
                    />
                    <span className={`engine-badge badge-${eng}`}>
                      {ENGINE_META[eng].badge}
                    </span>
                    <span className="radio-text">
                      <span className="radio-name">{ENGINE_META[eng].label}</span>
                      <span className="radio-hint">{ENGINE_META[eng].hint}</span>
                    </span>
                  </label>
                ))}

                {meta.needsKey && (
                  <div className="key-section">
                    <label className="key-label">
                      API Key — {meta.label}
                    </label>
                    <input
                      type="password"
                      className="win-input"
                      placeholder="Cole sua chave aqui..."
                      value={apiKey}
                      onChange={e => handleApiKeyChange(e.target.value)}
                    />
                    <div className="key-warning">
                      ⚠ Chave salva localmente. Use apenas para testes.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel results-panel">
              <div className="panel-title">◧ GALERIA ({imgs.length})</div>
              <div className="results-list">
                {imgs.length === 0 ? (
                  <div className="empty-gallery">[ nenhuma captura ainda ]</div>
                ) : (
                  [...imgs].reverse().map((img, idx) => {
                    const num = imgs.length - idx;
                    return (
                      <React.Fragment key={num}>
                        <div className="result-item">
                          <div className="result-index">
                            #{String(num).padStart(2, '0')}
                          </div>
                          <img
                            src={img.base64}
                            className="picture"
                            alt={`captura ${num}`}
                          />
                          <div className="result-body">
                            <span className={`engine-badge badge-${img.engine}`}>
                              {ENGINE_META[img.engine].badge}
                            </span>
                            <div className="result-text">
                              {img.texto.trim() || '(sem texto reconhecido)'}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="status-bar">
        <span className="status-segment">✓ Pronto</span>
        <span className="status-segment">
          Motor: <strong>{meta.label}</strong>
        </span>
        <span className="status-segment">
          Visitantes: <strong>{imgs.length}</strong>
        </span>
        <span className="status-segment">© 1997 FOTOZ Corp.</span>
      </div>

    </div>
  );
};
