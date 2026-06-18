# Transformación a PWA y Diseño Responsivo (Mobile-First)

Este plan detalla los pasos técnicos para convertir el CRM de Kuden en una Progressive Web App instalable y optimizar la interfaz para su uso en teléfonos móviles.

## User Review Required

> [!IMPORTANT]
> **Aprobación de Íconos PWA:** Para que un teléfono permita instalar la App, requiere por defecto íconos cuadrados en resolución 192x192 y 512x512 (PNG). ¿Tienes el logo de Kuden (o de Kimi) en formato imagen para usarlos, o prefieres que genere un ícono genérico inicial con los colores de la marca para avanzar hoy y los cambias después?

> [!WARNING]
> **Cambios en Interfaz (UI):** Actualmente el código usa estilos en línea fijos (ej. ancho de 250px para el menú). Migraré esto a un sistema responsivo híbrido. El menú lateral en celular quedará oculto y se abrirá con un botón "Hamburguesa" (☰).

## Open Questions

1. En el CRM (`CRMManager`), hay 3 columnas (Contactos, Chat, Vista 360°). En el teléfono no caben las 3 a la vez. Mi propuesta es que la pantalla inicial del CRM en el celular muestre la lista de contactos, y al presionar uno, el Chat pase a **pantalla completa** (ocultando la lista hasta que el usuario presione "Atrás"). ¿Te parece bien esta navegación estándar de chat?

## Proposed Changes

### Dependencias y Configuración (PWA)

#### [MODIFY] [package.json](file:///C:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/package.json)
- Instalar la librería `vite-plugin-pwa` para inyectar automáticamente los Service Workers y manejar la caché offline.

#### [MODIFY] [vite.config.js](file:///C:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/vite.config.js)
- Agregar el plugin `VitePWA` configurando el `manifest.json` interno con:
  - `name`: "Kuden IA"
  - `short_name`: "Kuden"
  - `theme_color`: "#1a1a2e" (Dark) / "#f8faff" (Light)
  - `display`: "standalone" (Para ocultar el navegador).

### CSS Global y Responsividad

#### [MODIFY] [index.css](file:///C:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/src/index.css)
- Añadir variables CSS y Media Queries (`@media (max-width: 768px)`) para manejar la visibilidad de los paneles.
- Crear clases utilitarias para ocultar elementos en móvil (`.hide-on-mobile`, `.mobile-only`).

### Adaptación de Componentes

#### [MODIFY] [DashboardLayout.jsx](file:///C:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/src/admin/DashboardLayout.jsx)
- Implementar lógica para ocultar el Sidebar (menú lateral) por defecto en pantallas pequeñas.
- Añadir un botón flotante o en un *Top Bar* para abrir/cerrar el menú en modo móvil.
- Asegurar que el área central (`children`) tome el 100vw de ancho.

#### [MODIFY] [CRMManager.jsx](file:///C:/Users/vlevi/OneDrive/Documentos/antigravity/GIT/Kuden-IA/kuden-ia/frontend/src/admin/CRMManager.jsx)
- Manejar un estado visual responsivo (`isMobileChatView`).
- Mostrar solo la columna de Kanban/Contactos por defecto en celular.
- Al seleccionar una conversación, ocultar la columna de contactos y mostrar el chat al 100% de ancho con un botón para "Volver a la lista".
- Esconder la "Vista 360" en móviles dentro de una pestaña colapsable (Drawer) en la esquina superior derecha del chat.

## Verification Plan

### Manual Verification
1. Abriré el proyecto en el navegador usando la "Vista de Dispositivos" (DevTools) simulando un iPhone y verificaré la navegación.
2. Haré un build (`npm run build`) para verificar que `vite-plugin-pwa` genera los archivos `sw.js` y `manifest.webmanifest`.
3. Pediré al usuario desplegar en Vercel y abrirlo desde su teléfono real para probar la opción "Añadir a la Pantalla de Inicio".
