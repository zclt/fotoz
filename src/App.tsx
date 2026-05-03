import React from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

import './style.css';

type CapturedImage = {
  base64: string;
  texto: string;
};

export const App = () => {
  const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
  const [imgs, setImgs] = React.useState<CapturedImage[]>([]);
  const [rearCamera, setRearCamera] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const webcamRef = React.useRef<Webcam>(null);

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    setProcessing(true);
    setError(null);

    Tesseract.recognize(imageSrc, 'eng')
      .then(({ data: { text } }) => {
        setImgs(prev => [...prev, { texto: text, base64: imageSrc }]);
      })
      .catch(() => setError('Falha ao reconhecer texto na imagem.'))
      .finally(() => setProcessing(false));
  }, []);

  const handleDevices = React.useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevice = mediaDevices.find(({ kind }) => kind === 'videoinput');
    setDeviceId(videoDevice?.deviceId);
  }, []);

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  return (
    <>
      <span>Camera</span>
      <button onClick={() => setVisible(v => !v)}>
        {visible ? 'Esconder' : 'Mostrar'}
      </button>
      <button onClick={() => setRearCamera(c => !c)} disabled={!visible}>
        Alternar câmera
      </button>
      <button onClick={capture} disabled={!visible || processing}>
        {processing ? 'Processando...' : 'Snapshot'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        {visible && (
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
        )}
      </div>
      <div>
        {imgs.map((img, idx) => (
          <React.Fragment key={idx}>
            <img src={img.base64} className="picture" alt={`captura ${idx + 1}`} />
            <span>{img.texto}</span>
          </React.Fragment>
        ))}
      </div>
    </>
  );
};
