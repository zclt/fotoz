# fotoz

## Relatório Técnico de Avaliação

**Tipo:** Prova de Conceito (PoC)
**Data de avaliação:** 2026-05-02
**Responsável:** Matheus Zucolotto

---

## 1. Objetivo

Avaliar a viabilidade técnica do uso de **Tesseract.js** para reconhecimento óptico de caracteres (OCR) diretamente no navegador, integrado a uma câmera em tempo real via Web API. A PoC responde à seguinte pergunta central:

> *É possível capturar uma imagem via webcam e extrair texto dela com qualidade suficiente para uso em produto, sem depender de um serviço de OCR externo?*

---

## 2. Stack avaliada

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework UI | React | 19.2.5 |
| Linguagem | TypeScript | 6.0.3 |
| Bundler | Vite | 8.0.10 |
| OCR | tesseract.js | 7.0.0 |
| Câmera | react-webcam | 7.2.0 |
| Testes | Vitest + Testing Library | 4.1.5 / 16.3.2 |

---

## 3. Funcionamento

O fluxo da PoC é composto por três etapas:

```
Câmera (MediaDevices API)
        │
        ▼
Captura de screenshot (base64 PNG)
        │
        ▼
Tesseract.recognize(imagem, 'eng')
        │
        ▼
Exibição: imagem capturada + texto extraído
```

1. **Enumeração de dispositivos** — ao montar o componente, `navigator.mediaDevices.enumerateDevices()` detecta câmeras disponíveis e seleciona a primeira.
2. **Captura** — `react-webcam` renderiza o stream via `<video>` e expõe `getScreenshot()`, que retorna a imagem como `data:image/png;base64`.
3. **OCR** — `Tesseract.recognize()` processa a imagem inteiramente no navegador usando WebAssembly. Retorna `{ data: { text } }` com o texto reconhecido.
4. **Persistência local** — as capturas ficam em estado React (`useState`), sem persistência entre sessões.

---

## 4. Diagnóstico do código original

A versão inicial da PoC apresentava os seguintes problemas:

### Infraestrutura
| Problema | Impacto |
|---|---|
| `react-scripts` (Create React App) — abandonado desde 2023 | Build quebrado com Node moderno; sem updates de segurança |
| `react-scripts: "latest"` em devDependencies | Instalação não determinística |
| React 18.2.0 / TS 5.1.6 desatualizados | 3 versões major atrasadas no React |

### Bugs de código (`src/App.tsx`)

**1. Mutação direta de estado**
```typescript
// antes — mutação direta do array antes de chamar setter
imgs.push({ texto: imgTxt.data.text, base64: imageSrc });
setImgs([...imgs]);

// depois — imutável via updater function
setImgs(prev => [...prev, { texto: text, base64: imageSrc }]);
```

**2. Ref sem tipagem (crash silencioso)**
```typescript
// antes — sem tipo, acesso direto sem guard
const webcamRef = React.useRef(null);
const imageSrc = webcamRef.current.getScreenshot(); // TypeError em runtime

// depois — tipado + optional chaining
const webcamRef = React.useRef<Webcam>(null);
const imageSrc = webcamRef.current?.getScreenshot();
```

**3. Estado `deviceId` mal tipado**
```typescript
// antes — inicializado como objeto vazio, usado como MediaDeviceInfo
const [deviceId, setDeviceId] = React.useState({});

// depois — tipo correto
const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
```

**4. Sem feedback visual durante OCR**
O processo de OCR leva entre 1–5 segundos dependendo da imagem. O botão ficava ativo e sem indicação de progresso, permitindo múltiplos cliques simultâneos.

**5. `key` prop ausente em fragmentos**
```typescript
// antes — warning React + comportamento undefined na reconciliação
imgs.map((imgSrc, key) => (
  <>
    <img ... />
    <span>{imgSrc.texto}</span>
  </>
))

// depois
imgs.map((img, idx) => (
  <React.Fragment key={idx}>
    ...
  </React.Fragment>
))
```

**6. Tesseract sem idioma especificado**
```typescript
// antes — usa modelo padrão (inglês implícito, sem otimização)
Tesseract.recognize(imageSrc)

// depois — idioma explícito, melhora precisão
Tesseract.recognize(imageSrc, 'eng')
```

**7. Sem tratamento de erro com feedback ao usuário**
Erros do OCR eram apenas logados no console, invisíveis ao usuário.

---

## 5. Refatoração aplicada

Além da correção dos bugs, a PoC passou por uma atualização completa de infraestrutura:

- **CRA → Vite 8**: cold start de ~3s para ~300ms; HMR instantâneo
- **React 18 → 19**: melhorias de performance no scheduler e Suspense
- **TypeScript strict mode**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`
- **Testes com Vitest**: 7 casos de teste cobrindo render, interações e fluxo de OCR (mock de `tesseract.js` e `react-webcam`)

---

## 6. Cobertura de testes

| Teste | Tipo | Descrição |
|---|---|---|
| Renderiza sem câmera por padrão | Unitário | Estado inicial do componente |
| Exibe câmera ao clicar Mostrar | Integração | Toggle de visibilidade |
| Esconde câmera ao clicar Esconder | Integração | Toggle reverso |
| Snapshot desabilitado sem câmera | Unitário | Guard de interação |
| Snapshot habilitado com câmera | Integração | Habilitação condicional |
| Executa OCR e exibe texto | Integração | Fluxo principal (happy path) |
| Exibe erro quando OCR falha | Integração | Tratamento de falha |
| Alternar câmera desabilitado sem câmera | Unitário | Guard de interação |

---

## 7. Limitações identificadas

### Técnicas
- **Precisão do OCR**: Tesseract.js tem desempenho notavelmente inferior a serviços como Google Vision ou AWS Textract, especialmente em texto manuscrito, fontes incomuns, ou imagens com baixo contraste.
- **Idioma único**: a PoC configura apenas `'eng'`. Textos em português com acentuação podem apresentar erros de reconhecimento sem o modelo `por` carregado.
- **Performance client-side**: o modelo Tesseract via WASM consome ~80–150 MB de memória e o processamento leva 1–5 segundos por imagem em hardware mediano. Em dispositivos móveis de entrada, pode ser proibitivo.
- **Sem pré-processamento de imagem**: a qualidade do OCR depende diretamente da qualidade da captura. Não há ajuste de contraste, binarização ou remoção de ruído.
- **Persistência de sessão**: as capturas são mantidas apenas em memória. Recarregar a página perde todo o histórico.

### Operacionais
- **Permissão de câmera**: requer HTTPS em produção (`getUserMedia` é bloqueado em HTTP por política de origem segura).
- **Compatibilidade**: WASM é suportado em todos os navegadores modernos, mas `navigator.mediaDevices` requer contexto seguro.

---

## 8. Avaliação de viabilidade

| Critério | Avaliação | Observação |
|---|---|---|
| Funciona no navegador sem backend | Sim | OCR 100% client-side via WASM |
| Precisão aceitável para texto impresso claro | Moderada | Bom para documentos com fundo branco |
| Precisão para texto em imagens naturais | Baixa | Sensível a iluminação e ângulo |
| Viável em mobile | Condicional | Depende do hardware do dispositivo |
| Adequado para produção sem modificações | Não | Falta pré-processamento, UI mínima, idiomas |
| Adequado como base para evoluir | Sim | Fluxo central validado |

---

## 9. Recomendações para próximos passos

**Se o objetivo é produção com OCR de alta precisão:**
Integrar com um serviço de OCR gerenciado (Google Vision API, AWS Textract) usando Tesseract.js apenas como fallback offline ou para casos simples.

**Se o objetivo é manter o OCR client-side:**
1. Adicionar pré-processamento de imagem (contraste, binarização) via Canvas API antes de enviar ao Tesseract
2. Carregar o modelo em português (`por`) para suporte a acentuação
3. Considerar `tesseract.js` em um Web Worker para não bloquear a thread principal durante o processamento
4. Implementar persistência das capturas (IndexedDB ou localStorage)

**Se o objetivo é validar o fluxo de câmera → dados:**
A PoC cumpre o papel. O pipeline `MediaDevices → screenshot → processamento assíncrono → resultado` está funcional e testado.

---

## 10. Como executar

```bash
# instalar dependências
npm install

# desenvolvimento
npm run dev

# testes
npm test

# cobertura de testes
npm run test:coverage

# build de produção
npm run build
```

> **Nota:** requer HTTPS ou `localhost` para acesso à câmera via `navigator.mediaDevices`.

---

## Estrutura do projeto

```
fotoz/
├── index.html              # entry point Vite
├── vite.config.ts          # configuração Vite + Vitest
├── tsconfig.json           # TypeScript strict
├── src/
│   ├── index.tsx           # bootstrap React
│   ├── App.tsx             # componente principal
│   ├── App.test.tsx        # testes
│   ├── setupTests.ts       # setup jest-dom
│   └── style.css           # estilos base
└── public/                 # assets estáticos
```
