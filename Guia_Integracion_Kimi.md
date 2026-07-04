# Guía Rápida de Integración — Kimi AI Co-Piloto

Este paquete modular permite integrar a **Kimi Co-Piloto AI** (`assets/kimi.png`) en cualquier proyecto web de Kuden (como **Kuden IA SaaS** `app.kuden.cl` o **Kuden QA SaaS** `qa.kuden.cl`) en menos de 2 minutos.

---

## 1. Archivos del Paquete Modular

Para llevar a Kimi a otro proyecto, solo necesitas copiar estos archivos a la raíz o carpeta de activos de tu nueva plataforma:
1. `kimi-widget.css`: Contiene todos los estilos visuales, órbitas animadas por color, sombras pulsantes y las **7 animaciones de estado**.
2. `kimi-widget.js`: Controlador opcional para inyectar el **widget flotante interactivo en la esquina inferior derecha** de la pantalla.
3. `assets/kimi.png`: La imagen oficial de la mascota Kimi.

---

## 2. Modo A: Componente Flotante Interactivo (Esquina Inferior Derecha)

Si quieres que Kimi aparezca flotando en la esquina de tu aplicación (ej. en el panel de usuario de Kuden IA/QA para que los clientes puedan interactuar o ver qué está haciendo el sistema):

### Paso 1: Incluir en el `<head>` de tu HTML
```html
<link rel="stylesheet" href="kimi-widget.css">
```

### Paso 2: Incluir justo antes de cerrar el `</body>`
```html
<script src="kimi-widget.js"></script>
```

¡Listo! El script insertará automáticamente el avatar flotante de Kimi con su cápsula de diálogo *Glassmorphism*. Al hacer clic en él, el usuario o desarrollador puede probar en vivo los 7 estados operativos.

---

## 3. Modo B: Incrustar en Cualquier Sección o Banner de tu HTML

Si solo quieres mostrar a Kimi animado dentro de una tarjeta, encabezado o sección estática de la web (como lo hicimos en el Hero Principal y en el título de Arquitectura de la web corporativa), solo necesitas importar `kimi-widget.css` en el `<head>` y pegar el siguiente bloque HTML donde quieras que aparezca:

```html
<div class="kimi idle" style="width: 120px; height: 120px; margin: 0 auto;">
  <div class="kimi-orbit orbit-outer"><span class="kimi-sat sat-1"></span></div>
  <div class="kimi-orbit orbit-inner"><span class="kimi-sat sat-2"></span></div>
  <img src="assets/kimi.png" alt="Kimi AI">
</div>
```

### Cambiar el Estado Operativo por Clases o JavaScript

Puedes cambiar la clase principal del contenedor para que Kimi transforme instantáneamente su color de sombra, velocidad orbital y animación según la acción que esté realizando tu software:

| Clase CSS | Estado | Descripción & Efecto Visual |
| :--- | :--- | :--- |
| `kimi idle` | **Reposo / Vigilancia** | Órbitas púrpura/azul girando en sentidos opuestos, respiración suave. |
| `kimi listening` | **Escucha Activa** | Sombra y anillo exterior palpitando como radar esmeralda (`#10B981`). |
| `kimi thinking` | **Procesando / Analizando** | Rotación analítica rápida con satélites cian cuánticos (`#00F0FF`). |
| `kimi speaking` | **Asistiendo / Hablando** | Destello ámbar vibrante (`#F59E0B`) que rebota con la voz. |
| `kimi success` | **Éxito / Auditoría 100%** | Explosión dorada triunfal (`#FACC15`) con anillo sólido. |
| `kimi handoff` | **Derivación Humana** | Aura levitante magenta (`#D946EF`) que asciende suavemente. |
| `kimi sleep` | **Modo Nocturno / Ahorro** | Órbitas en cámara lenta con resplandor tenue azul noche. |

---

## 4. Control Dinámico desde JavaScript (Ejemplo en Frontend SaaS)

Si quieres actualizar el estado de Kimi de forma dinámica cuando el sistema hace una petición a la API o termina un proceso:

```javascript
const kimiAvatar = document.querySelector('.kimi');

// Cuando el sistema empieza a transcribir o escuchar:
kimiAvatar.className = 'kimi listening';

// Cuando la IA está evaluando una pauta QA:
kimiAvatar.className = 'kimi thinking';

// Cuando la auditoría finaliza con éxito:
kimiAvatar.className = 'kimi success';
```
