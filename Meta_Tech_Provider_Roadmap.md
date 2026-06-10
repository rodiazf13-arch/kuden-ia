# Guía Estratégica: Kuden IA como Meta Tech Provider (BSP)

Este documento es la guía maestra para todas las áreas de Kuden IA (Dirección, Tecnología, Ventas y Operaciones). Explica paso a paso cómo nos convertiremos en un Proveedor Tecnológico oficial de Meta y cómo será la experiencia de nuestros clientes al conectar sus números de WhatsApp.

---

## 1. ¿Qué es un Meta Tech Provider y por qué es vital?
Un **Tech Provider** (antes Business Solution Provider o BSP) es una empresa certificada por Meta para gestionar cuentas de WhatsApp Business a gran escala en nombre de terceros (nuestros clientes). 
En lugar de que cada cliente contrate programadores para conectar WhatsApp a Kuden, Meta nos da las herramientas para conectar sus números en 3 clics usando el **Embedded Signup** (Registro Integrado).

---

## 2. Fase 1: Certificando a Kuden IA (Paso a Paso Interno)
*Responsables: Dirección, Legal y Equipo Técnico.*

### Paso 1: Verificación del Negocio en Meta
Meta necesita saber que Kuden IA es una empresa real y legalmente constituida.
- **Acción:** Ir al *Meta Business Manager* de Kuden -> *Centro de Seguridad* -> Iniciar Verificación.
- **Requisitos:** Deberán subir el acta constitutiva de la empresa, el RUT/Razón Social, y un recibo de servicios (luz/agua) o extracto bancario que coincida exactamente con el nombre legal y dirección.
- **Tiempo estimado:** Meta tarda de 1 a 3 días hábiles en aprobar (o rechazar pidiendo más claridad en las fotos).

### Paso 2: Alineación Legal y Transparencia
- **Acción:** Kuden debe tener una página web pública (landing page o sitio web).
- **Requisitos:**
    1. **Términos de Servicio:** Explicando nuestro modelo de software y asesoría.
    2. **Políticas de Privacidad (Crítico):** Detallando explícitamente cómo manejamos los datos de los usuarios finales (consumidores de nuestros clientes) y declarando que usamos las APIs de proveedores como Meta.
- *Nota:* Sin el enlace a la Política de Privacidad, Meta no nos permitirá avanzar.

### Paso 3: Registro y Configuración Técnica en Meta (Devs)
- **Acción:** El equipo técnico crea una App de tipo "Business" en *Meta for Developers* y añade el producto "WhatsApp".
- **Configuraciones clave (¡Importante!):**
    - Al configurar el producto WhatsApp, se debe seleccionar explícitamente el caso de uso **"Tech Provider"** (Proveedor Tecnológico).
    - Configurar nuestro **Webhook Serverless**: Una URL especial blindada para recibir miles de mensajes por segundo sin saturar la base de datos central.
    - Firmar digitalmente los "Tech Provider Terms" en el portal.

### Paso 4: Proceso de App Review (Revisión de la App por Meta)
Para que Meta nos apruebe los permisos avanzados (`whatsapp_business_management` y `whatsapp_business_messaging`) necesarios para el Embedded Signup, Meta exige:
- **Screencast (Grabación de pantalla):** Deberemos grabar un video demostrando cómo funciona la experiencia de registro dentro del panel de Kuden y cómo utilizamos esos permisos. (Esto lo grabaremos una vez tengamos el backend Serverless y el botón de Embedded Signup listos en nuestro entorno de pruebas).

---

## 3. Fase 2: El Onboarding del Cliente (El Flujo "Done-For-You")
*Responsables: Equipo de Ventas (explicación) y Clientes (ejecución).*

**Aclaración importante:** ¿El cliente necesita un Facebook o Business Manager (Portafolio Comercial) previo? 
**Respuesta:** El cliente *sí* necesita tener un perfil personal de Facebook para iniciar sesión. Sin embargo, **no es estrictamente necesario que ya tenga un Portafolio Comercial de empresa**. La maravilla del *Embedded Signup* es que si el cliente no tiene uno, la misma ventana emergente de Meta le guía para crear el portafolio, su cuenta de WhatsApp (WABA) y configurar todo en menos de 5 minutos.

### El Paso a Paso del Cliente (Interfaz Kuden):
1. **Acceso al CRM Kuden:** El cliente entra a su panel de administración en nuestra plataforma.
2. **Botón Mágico:** Hace clic en el botón *"Conectar WhatsApp Oficial"*.
3. **Ventana de Meta (Embedded Signup):** Se abre una ventana segura directamente de Facebook.
    - Inicia sesión con su cuenta personal de Facebook.
    - Meta pregunta: *"¿Qué negocio vas a conectar?"* (El cliente elige uno de la lista o hace clic en "Crear nuevo").
    - Meta le pide los datos del perfil de WhatsApp (Nombre visible de la empresa, categoría, descripción).
    - Meta le solicita un método de pago (Tarjeta de crédito) para facturarle directamente el costo de los mensajes a Meta.
4. **El "Apretón de Manos":** La ventana se cierra y Meta le envía a Kuden, de forma invisible, el "Token de Acceso".
5. **¡Listo!** Desde este momento, la IA de Kuden ya puede leer y responder mensajes en nombre de esa empresa. Cero código, cero estrés para el cliente.

---

## 4. Preguntas Frecuentes y Casos Típicos (FAQ)
*Material de apoyo didáctico para el equipo Comercial, Ventas y Operaciones.*

### Caso 1: El celular físico y la App de WhatsApp Business.
* **Cliente:** *"¿Puedo seguir usando mi WhatsApp Business en el celular de la empresa y que la IA de Kuden responda al mismo tiempo?"*
* **Equipo Kuden:** **No.** Al conectar el número a la API oficial mediante Kuden, el número se desconecta de la App móvil en tu teléfono. Sin embargo, no pierdes el control: todos tus ejecutivos humanos podrán chatear, intervenir y ver el historial en tiempo real desde nuestra bandeja del **CRM Kuden**. El número sube de nivel a una plataforma multi-agente corporativa.

### Caso 2: Propiedad del número.
* **Cliente:** *"Si me doy de baja de Kuden en el futuro, ¿secuestran o pierdo mi número de WhatsApp?"*
* **Equipo Kuden:** **En absoluto.** Como Tech Provider, nosotros operamos *en nombre de tu empresa*. La cuenta de WhatsApp Business y el número de teléfono siguen siendo 100% propiedad tuya dentro de tu propio *Business Manager*. Si decides irte, simplemente revocas el permiso de Kuden y tu número sigue siendo tuyo.

### Caso 3: Costos de Meta vs Costos de Kuden.
* **Cliente:** *"¿Cómo se cobran los mensajes, me los cobran ustedes o Meta?"*
* **Equipo Kuden:** Existen dos facturaciones separadas y transparentes:
    1. **Factura de Meta:** Meta te cobra directamente a tu tarjeta de crédito por las "conversaciones iniciadas" (recuerda que las primeras 1,000 conversaciones de servicio al mes suelen ser gratuitas).
    2. **Factura de Kuden:** Nosotros te cobramos la suscripción mensual por la inteligencia artificial, la plataforma (CRM), la infraestructura, las optimizaciones y el soporte experto.

### Caso 4: Usar un número fijo.
* **Cliente:** *"El número público de mi empresa es un teléfono fijo, ¿puedo usarlo en WhatsApp?"*
* **Equipo Kuden:** **¡Sí!** Meta acepta números fijos o móviles. Al momento de hacer el registro, Meta te enviará el código de verificación de 6 dígitos mediante una **llamada telefónica**. Solo debes asegurarte de estar cerca del teléfono y desactivar momentáneamente cualquier contestadora (IVR) o "marque 1 para hablar con ventas" para que escuches el código.

### Caso 5: Riesgo de Bloqueo por SPAM.
* **Interno (Ventas/Operaciones Kuden):** *"¿Qué pasa si un cliente hace SPAM masivo y Meta le bloquea el número? ¿Nos cierran la plataforma a nosotros?"*
* **Respuesta Técnica:** No. Como el número y el WABA le pertenecen al *Business Manager del cliente*, el bloqueo **solo afecta a ese cliente en particular**. No perjudica la reputación general de la aplicación de Kuden IA ni pone en riesgo los números de los demás clientes. Esta es la principal protección legal y operativa del modelo Tech Provider.
