import React from 'react';
import Webcam from 'react-webcam';
import Tesseract from 'tesseract.js';

import './style.css';

export const App = () => {
  const [deviceId, setDeviceId] = React.useState({});
  const [imgs, setImgs] = React.useState<{texto: string; base64: any}[]>([]);
  const [camera, setCamera] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  const webcamRef = React.useRef(null);

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    
    
    Tesseract.recognize(imageSrc)
      .then(result => {
        const imgTxt: {data:{ text }} = result;
        imgs.push({texto: imgTxt.data.text, base64: imageSrc});
        setImgs([...imgs]);
      })
      .catch(error => console.log(error));
    
  }, [webcamRef]);

  const handleDevices = React.useCallback(
    (mediaDevices) => {
      const devices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      setDeviceId(devices.find((o) => o));
    },
    [setDeviceId]
  );

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  return (
    <>
      <span>Camera</span>      
      <button onClick={() => setVisible(!visible)}>Show</button>
      <button onClick={() => setCamera(!camera)} disabled={!visible}>Switch</button>
      <button onClick={capture} disabled={!visible}>Snapshot</button>
      <div>
        {visible ? (
          <Webcam
            ref={webcamRef}
            id="webcam"
            audio={false}
            screenshotQuality={1}
            screenshotFormat="image/png"
            videoConstraints={{
              width: 400,
              deviceId: deviceId,
              facingMode: camera ? 'environment' : 'user',
            }}
            forceScreenshotSourceSize={true}
            onDoubleClick={capture}
          />
        ) : (
          <></>
        )}
      </div>
      <div>
        {imgs.map((imgSrc, key) => (
          <>
            <img
              id={key.toString()}
              src={imgSrc.base64}
              className="picture"
            />
            <span>{imgSrc.texto}</span>
          </>
        ))}
      </div>
    </>
  );
};
