# Kimi Widget para productos Kuden

Componente reutilizable de Kimi basado en `kimi-svg-demo.html`. Está construido como **Web Component**, por lo que funciona en HTML, JavaScript, React, Vue, Angular y aplicaciones que utilicen Vite, Next.js u otros empaquetadores.

No requiere imágenes, hojas CSS ni dependencias externas. El SVG, los estilos y las animaciones están encapsulados dentro del componente para evitar conflictos con cada producto.

## Archivos

- `kuden-kimi-widget.js`: componente completo.
- `kuden-kimi-widget.d.ts`: tipos para proyectos TypeScript.
- `demo.html`: laboratorio funcional de integración.
- `package.json`: permite publicarlo como paquete interno si se desea.

## Integración directa en HTML

Copiar `kuden-kimi-widget.js` al proyecto y cargarlo como módulo:

```html
<script type="module" src="/components/kuden-kimi-widget.js"></script>

<kuden-kimi-widget
  id="kimi"
  product="Kuden QA"
  state="idle"
  position="right"
  theme="auto"
  size="medium"
  closable="true"
  auto-cycle
  cycle-interval="10000">
</kuden-kimi-widget>
```

## Integración mediante npm o un paquete privado

La carpeta puede publicarse en el registro privado de Kuden o instalarse directamente desde una ruta local:

```bash
npm install ../kimi-widget-portable
```

Luego se registra una sola vez en el punto de entrada del producto:

```js
import '@kuden/kimi-widget';
```

Y se utiliza en el HTML de la aplicación:

```html
<kuden-kimi-widget product="Kuden IA"></kuden-kimi-widget>
```

## Estados disponibles

| Estado | Uso sugerido |
| --- | --- |
| `idle` | Disponible o esperando una acción. |
| `thinking` | Consultando datos, IA o servicios. |
| `success` | Proceso completado correctamente. |
| `walking` | Recorriendo lotes, módulos o tareas. |
| `spinning` | Cambio de contexto o módulo. |
| `pulse` | Integración o ecosistema conectado. |
| `curious` | Hallazgo, alerta o inspección. |
| `sleeping` | Reposo o ausencia de actividad. |

## Conectar Kimi con una operación real

```js
const kimi = document.querySelector('kuden-kimi-widget');

async function analizarInteraccion(id) {
  kimi.setState('thinking', {
    title: 'Analizando la interacción',
    message: 'Estoy contrastando la conversación con la pauta de calidad.'
  });

  try {
    const resultado = await api.auditar(id);

    kimi.setState('success', {
      title: 'Auditoría completada',
      message: `Resultado disponible: ${resultado.nota}% de cumplimiento.`
    });
  } catch (error) {
    kimi.setState('curious', {
      title: 'Necesito revisar algo',
      message: 'No pude completar la consulta. Verifica la conexión e inténtalo nuevamente.'
    });
  }
}
```

El contenido se inserta mediante `textContent`; no se interpreta como HTML.

## API JavaScript

### Cambiar estado

```js
kimi.setState('thinking');
kimi.setState('success', {
  title: 'CRM actualizado',
  message: 'La información quedó registrada correctamente.'
});
```

### Cambiar o restaurar el mensaje

```js
kimi.setMessage('Título propio', 'Mensaje propio del producto.');
kimi.useDefaultMessage();
```

Los mensajes definidos con `setMessage` o con las propiedades `title` y `message` de `setState` se mantienen hasta ejecutar `useDefaultMessage()`.

### Hablar con efecto de escritura

```js
await kimi.speak(
  'Kimi Insights',
  'Encontré una tendencia que puede afectar la conversión.',
  { speed: 24 }
);
```

### Mostrar, minimizar y alternar

```js
kimi.hide();
kimi.show();
kimi.toggle();
```

### Avanzar al siguiente estado configurado

```js
kimi.advance();
```

## Atributos

| Atributo | Valores | Predeterminado |
| --- | --- | --- |
| `product` | Texto visible sobre el mensaje | `Kuden` |
| `state` | Cualquiera de los estados disponibles | `idle` |
| `position` | `right`, `left` | `right` |
| `theme` | `auto`, `light`, `dark` | `auto` |
| `size` | `small`, `medium`, `large` | `medium` |
| `closable` | `true`, `false` | `true` |
| `auto-cycle` | atributo booleano | desactivado |
| `cycle-interval` | milisegundos, mínimo 3000 | `10000` |
| `cycle-states` | estados separados por coma | `idle,thinking,success` |
| `bubble-title` | título personalizado | según estado |
| `message` | mensaje personalizado | según estado |
| `hide-bubble` | atributo booleano | desactivado |
| `minimized` | atributo booleano | desactivado |
| `csp-nonce` | nonce autorizado para estilos | ninguno |

Ejemplo de ciclo personalizado:

```html
<kuden-kimi-widget
  auto-cycle
  cycle-interval="15000"
  cycle-states="idle,thinking,curious,success">
</kuden-kimi-widget>
```

## Variables CSS

Aunque el componente está encapsulado, se pueden ajustar variables desde la aplicación:

```css
kuden-kimi-widget {
  --kimi-offset-x: 20px;
  --kimi-offset-y: 20px;
  --kimi-z-index: 1200;
  --kimi-accent: #635bff;
  --kimi-cyan: #37d7ff;
}
```

## Eventos

```js
kimi.addEventListener('kimi-state-change', ({ detail }) => {
  console.log(detail.state, detail.source);
});

kimi.addEventListener('kimi-minimize', () => {
  analytics.track('Kimi minimizado');
});

kimi.addEventListener('kimi-restore', () => {
  analytics.track('Kimi restaurado');
});
```

`detail.source` puede ser `click`, `auto`, `api` o `attribute`.

## React

Importar el componente solamente en el cliente. En una aplicación React tradicional:

```jsx
import '@kuden/kimi-widget';

export function Kimi() {
  return <kuden-kimi-widget product="Kuden IA" auto-cycle="true" />;
}
```

Para controlar la API imperativa:

```jsx
import { useEffect, useRef } from 'react';
import '@kuden/kimi-widget';

export function Kimi({ procesando }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.setState(procesando ? 'thinking' : 'idle');
  }, [procesando]);

  return <kuden-kimi-widget ref={ref} product="Kuden IA" />;
}
```

En Next.js debe importarse desde un componente cliente (`'use client'`) o mediante `import()` dentro de `useEffect`.

## Vue

```js
import '@kuden/kimi-widget';
```

Si el compilador muestra una advertencia por el tag personalizado, declararlo como elemento personalizado:

```js
// vite.config.js
export default {
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === 'kuden-kimi-widget'
      }
    }
  }
};
```

## Angular

Importar el módulo en el punto de entrada y habilitar `CUSTOM_ELEMENTS_SCHEMA` en el módulo o componente que lo utilice.

```ts
import '@kuden/kimi-widget';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
```

## Accesibilidad y comportamiento

- El avatar y los controles son botones operables por teclado.
- Minimizar no elimina el componente: muestra un lanzador para restaurarlo.
- Los cambios automáticos no interrumpen al lector de pantalla.
- Respeta `prefers-reduced-motion`.
- El ciclo automático se pausa si la pestaña está oculta o Kimi está minimizado.
- En móviles, la burbuja se ubica encima de Kimi para evitar salir de la pantalla.

## Content Security Policy

El componente utiliza estilos encapsulados dentro del Shadow DOM. Para políticas CSP que exijan nonce:

```html
<kuden-kimi-widget csp-nonce="NONCE_GENERADO_POR_EL_SERVIDOR"></kuden-kimi-widget>
```

El valor debe coincidir con el nonce autorizado en `style-src`.

## Recomendación de uso

No conviene hacer que Kimi cambie constantemente durante una tarea crítica. La mejor experiencia es vincular sus estados a eventos reales del producto y utilizar `auto-cycle` solamente en pantallas informativas o de espera.
