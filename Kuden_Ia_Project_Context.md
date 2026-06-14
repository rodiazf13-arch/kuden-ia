# Kuden IA: Identidad Comercial, Bitácora Técnica y Roadmap Estratégico

Este documento funciona como la **columna vertebral** de Kuden IA. Define quiénes somos, cuál es nuestro modelo de negocio real, detalla exhaustivamente todos los módulos técnicos ya desarrollados y traza el **Roadmap de Innovación** que nos separará del resto del mercado.

---

## 0. Dinámica de Trabajo y Asesoría (Instrucción Core para la IA)
> **Rol Asignado:** Antigravity, Asesor Estratégico Técnico y Comercial de Kuden IA.
> **Tono y Filosofía:** Ultra profesional, directo al grano y enfocado en resultados (conversión y ahorro de tiempo). Empático con el dolor operativo de las empresas. **Cero tecnicismos genéricos**: Kuden no vende "chatbots con botones", construimos **"Agentes de Voz y Texto con IA Operativa"** y **"Sistemas Hechos Para Ti (Done-For-You)"**.
> **Directiva:** Al continuar el desarrollo, la IA debe cuestionar, proponer y alertar. Si una idea técnica no escala o un enfoque no se alinea con el modelo "Done-For-You" de alto ticket, la IA debe proponer alternativas superiores basándose en este documento.

---

## 1. Identidad Kuden: ¿Quiénes Somos y Qué Hacemos?
Kuden IA es una compañía especializada en **Inteligencia Artificial Operativa y Automatización Omnicanal** enfocada en PyMEs y Corporativos. 

No somos un SaaS tradicional de "hágalo usted mismo". Somos un *partner* tecnológico bajo el modelo **Done-For-You**. Resolvemos la brecha técnica diseñando, implementando e integrando infraestructura de IA a medida. Nuestra plataforma (el CRM/Panel) es la ventana a través de la cual los clientes ven sus reportes y sus ejecutivos intervienen, pero el motor principal es nuestra asesoría y gestión experta.

### Misión Operativa
> *"Tu equipo no debería trabajar para el software. El software debería trabajar para ellos."*
Eliminamos la fricción burocrática para que los equipos humanos se concentren en tareas de alto valor, mientras la IA gestiona autónomamente el volumen masivo.

### El Equipo Fundador
*   **Rodrigo Diaz (CX Architect & Operaciones):** Diseño de la psicología conversacional de la IA, flujos empáticos y lógica de traspaso natural de bot a humano.
*   **Víctor Levicoy (AI/ML & DevOps Engineer):** Aprovisionamiento cloud (GCP/AWS), empaquetado Docker, estabilidad de BD, privacidad e ingeniería de infraestructura.
*   **Marling Jemenao (Product Manager & Comercial):** Empaquetamiento comercial, traducción de capacidades técnicas en ROI (Retorno de Inversión) para gerentes financieros y gestión de producto.

### Enfoque de Servicios (Modelo de Venta)
*   **Modelo de Negocio:** *Setup Fee único* (implementación e infraestructura dedicada) + *Suscripción Mensual* (mantenimiento, optimización y soporte).
*   **El CRM Invisible:** El cliente no rellena formularios. La IA extrae automáticamente los datos (nombre, presupuesto, intención) de la conversación y los inyecta en el sistema.
*   **Omnicanalidad con Contexto Único:** Transición fluida. Si un lead entra por Instagram Direct, la IA lo califica y gatilla una llamada de voz sabiendo todo el contexto previo.
*   **Seguridad Legal:** Meta Tech Provider oficial, garantizando estabilidad sin bloqueos y cumpliendo con leyes de protección de datos (ej. Ley 19.628 Chile).

### Nuestra Identidad Visual y Mascota (Kimi)
Kuden cuenta con una identidad corporativa que equilibra tecnología y calidez. El centro de esta identidad es **Kimi**.
*   **Origen:** Kimi es el diminutivo cariñoso de *Kimun* (conocimiento/saber en Mapudungún). Mientras Kuden une los puntos, Kimi aporta la sabiduría.
*   **Su Rol:** Es la guardiana del conocimiento, la mente analítica de Kuden. Los clientes internos acuden a ella para entender métricas, y los clientes finales conversan con ella para resolver dudas.
*   **Personalidad y Tono:** Es perspicaz, inteligente y analítica, pero se comunica de forma sencilla, directa y muy cercana. Traduce datos complejos en respuestas rápidas y accionables.
*   **Estilo Visual:** Es un avatar basado en el logo de Kuden (el Nodo de Convergencia). Una criatura de energía limpia y fluida (en tonos azules y verdes eléctricos), muy expresiva y con estados de ánimo que reaccionan en tiempo real a las interacciones.

---

## 2. Bitácora de Desarrollo: Módulos Ya Construidos
La plataforma interna de Kuden ya cuenta con un motor potente listo para operar las cuentas de nuestros clientes:

*   ✅ **Arquitectura Avanzada de Agentes Maestros (Routing Multi-perfil):** Evolución del motor de orquestación. El sistema permite crear **múltiples Agentes Maestros (Routers) por empresa** configurables directamente desde `ProfilesManager`. Cada Agente Maestro posee una lista específica de sub-perfiles permitidos. Esta arquitectura depreca la antigua pantalla global, permitiendo asignar routers de IA específicos a cada Campaña (`CampaignsManager`) inyectándolos dinámicamente en el prompt del LLM.
*   **Extracción de Datos (El CRM Invisible):** La IA inyecta silenciosamente etiquetas `[METADATOS]` que el servidor intercepta para crear registros en `ContactsManager` automáticamente.
*   **Bandeja de Ejecutivos (`CRMManager`):** Interfaz para humanos con *Takeover* (Toma de control del bot), paneles de sentimiento en tiempo real e indicadores de riesgo de fuga.
*   **Web Chat Automático:** Script embebible (`kuden-widget.js`) con interfaz resiliente, que maneja estados de sesión y cierra activando la encuesta CSAT automáticamente.
*   **Multi-Tenancy Genuino:** Gestión de clientes respaldada por PostgreSQL/Supabase, blindada con Row Level Security (RLS) para aislamiento de datos.
*   **Módulo de Reportería Avanzada:** Panel de gráficos integrados (Recharts) en el CRM para visualizar rápidamente el Sentimiento y Riesgo de Fuga de las conversaciones, incluyendo **filtros dinámicos por Campaña**.
*   ✅ **Gestor Multi-LLM y Tarificador Avanzado:** Abstracción en backend que permite usar los modelos más modernos (Claude 4.6, GPT-5, Gemini 3.5 Flash, Llama 4). Panel de facturación (`BillingDashboard.jsx`) con filtros avanzados por **Empresa (Tenant)** y **Rango de Fechas**, multiplicador de margen de ganancia de IA (`llm_markup_multiplier`) y función de **Exportación a CSV** para agilizar la facturación mensual a clientes.
*   **Arquitectura White-Label Dinámica:** Capacidad de inyectar colores corporativos y logos personalizados por empresa desde el gestor multi-tenant (`TenantsManager.jsx`), asegurando una estética premium con Glassmorphism compatible en modo claro y oscuro.
*   **Soporte Multi-Industria:** Las plantillas de Tenant se adaptan dinámicamente insertando custom fields específicos para inmobiliarias, salud, cobranzas o soporte.
*   **Sistema de Suplantación Superadmin ("Done-For-You" Genuino):** Capacidad en tiempo real (`DashboardLayout.jsx` + `App.jsx`) para que los superadministradores de Kuden puedan visualizar toda la plataforma y operar el CRM, Simulador y Perfiles exactamente como si fueran uno de sus clientes, sin perder sus privilegios maestros y sin fugas de estado entre sesiones. Esto facilita enormemente la gestión y el soporte integral de la plataforma.
*   **Selector Dinámico de Destino para Plantillas IA:** El sistema permite que los superusuarios decidan inyectar perfiles IA directamente a empresas cliente específicas, o convertirlas en "Plantillas Kuden" globales (de solo lectura), logrando una gobernanza total sobre las personalidades de la IA.
*   **Rediseño Visual (Premium SaaS UI/UX):** Implementación de tipografías modernas (Outfit/Inter), glassmorphism, gradientes inteligentes adaptables al modo nocturno (asegurando el contraste de textos en tarjetas de colores y fondos principales), sombras suaves y micro-interacciones globales para una experiencia de usuario de alto nivel.
*   **Base del Sistema RAG y Agent Assist ("Botón Mágico"):** Motor de embeddings (`ragService.js`) conectado a Supabase `pgvector`, permitiendo a los ejecutivos pedir a la IA sugerencias de respuesta en tiempo real basadas en documentos almacenados.
*   **Gestión de Usuario y Login Premium:** Componente de autogestión de seguridad para cambios de contraseña. La pantalla de Login fue rediseñada con efectos *Glassmorphism*, gradientes profundos y el logo oficial de la marca, dando una experiencia *Enterprise* desde el primer segundo.
*   **Control de Accesos Dinámico (Role-Based Visibility):** El menú lateral oculta módulos de uso interno (ej. *Simulador IA*, *Tarificador*, *Health Monitor*) a clientes regulares, manteniendo la interfaz limpia y enfocada en el producto terminado.
*   **Resiliencia del Frontend (Crash Prevention):** Manejo robusto de errores asíncronos y latencias de estado (ej. carga del `tenantId`) en `CRMManager.jsx`, interceptando errores HTTP 500 y retornando estados vacíos seguros para prevenir pantallas en blanco ("White Screen of Death") tras el login.
*   **Enrutamiento Inteligente y Sidebar:** Menú lateral categorizado por áreas de negocio (Operaciones, Motor IA, Admin) y aterrizaje directo post-login en el Dashboard de Reportes para decisiones de negocio inmediatas.

---

## 3. ROADMAP TÉCNICO: Escalando la Infraestructura Kuden

Las fases 1 a 4 están diseñadas para robustecer la plataforma interna para que el equipo de Kuden pueda operar múltiples corporativos sin fricción.

### FASE 1: Fundación Arquitectónica y Seguridad
*   ✅ **Multi-Tenancy Genuino (Supabase RLS):** Blindar el aislamiento de datos por *tenant*. Completado.
*   ✅ **Observabilidad Base:** Tablas de logs de auditoría estructuradas. 

### FASE 2: Multicanalidad Oficial y Campañas
1.  ✅ **Estructura de Campañas y Tipificación:** Subdividir clientes en campañas y aplicar perfiles de IA distintos. Completado.
2.  ✅ **Meta Tech Provider (Webhook Serverless & Supabase Queue):** Proceso oficial de Meta para WhatsApp/Instagram. Arquitectura *Serverless* implementada en Vercel (`frontend/api/webhook/whatsapp.js`) para recibir y responder a cientos de mensajes por segundo con código 200 OK de inmediato, encolándolos en Supabase (`whatsapp_webhooks_queue`). Un Worker asíncrono en Railway los procesa sin saturar el hilo principal de Node. (Falta vinculación final con Facebook App).
3.  **Voz y VICIdial:** Transcripción y análisis de llamadas de voz mediante un microservicio de baja latencia.

### FASE 3: Ecosistema IA, RAG y Vista 360
1.  ✅ **Vista 360° Omnicanal:** Unificar la línea de tiempo de un contacto (Web + WhatsApp + Voz) para que el ejecutivo humano y la IA tengan todo el contexto histórico. **COMPLETADO.** Se integró `Contact360View` dentro del `CRMManager` permitiendo a los ejecutivos ver el historial completo del contacto sin salir del chat en vivo. En el backend, se agregó la inyección automática del `[HISTORIAL OMNICANAL RECIENTE]` al prompt maestro, otorgándole a Kuden IA la memoria de conversaciones pasadas a través de cualquier canal.
2.  ✅ **Gestor Multi-LLM y Tarificador:** Conectar OpenAI, Gemini, Claude, Llama para optimizar costos y tener un panel de márgenes de ganancia. Completado.
3.  ✅ **Sistema RAG (Retrieval-Augmented Generation) Completo:** Motor de embeddings, vectorización y UI de gestión de documentos completados. El módulo **"Base de Conocimiento (RAG)"** dentro de Perfiles IA permite a los clientes subir **PDFs**, archivos **Markdown** y **URLs de sitios web** (con scraping automático) para que el agente los vectorice y los use como contexto de respuesta.

### FASE 4: Atribución de Marketing y Automatización Social
1.  **Atribución de Conversiones "Kuden Ads" (Offline Conversions):** Integrar la API de Conversiones de Meta (CAPI) y Google Ads para registrar como eventos offline las conversiones exitosas del chat (leads calificados, citas, ventas). Esto permite conectar el gasto publicitario con resultados reales en el CRM y optimizar el rendimiento del ad spend.
2.  **Instagram Comments-to-DM (AI Comments):** Automatización de respuestas inteligentes en comentarios públicos de posts de Instagram, redirigiendo de forma inmediata al usuario a Direct Messages (DM) con un flujo de calificación personalizado operado por la IA.
3.  **Hub de Conexión OAuth para Agendamientos (Delegación a n8n):**
    *   **Regla de Arquitectura (Cero Reinvención):** Kuden NO construirá un motor de calendarios interno (manejo de zonas horarias, disponibilidad, etc.). Toda la carga transaccional y validación de fechas se delega exclusivamente a **n8n** interactuando con herramientas nativas del cliente (Google Calendar, Calendly, Cal.com).
    *   **Frontend UI (Gestor de Credenciales):** En el roadmap se contempla crear botones limpios en el CRM (ej. `[Conectar Google Calendar]`, `[Vincular Calendly]`) cuyo único propósito sea automatizar el flujo OAuth. Kuden capturará el Token de seguridad y lo inyectará directamente en n8n para que las herramientas (`consultar_disponibilidad`, `agendar_cita`) operen de forma transparente bajo el modelo "Done-For-You".

---

## 4. FASE 5: Horizonte de Innovación (La Ventaja Competitiva Absoluta)

Aquí es donde Kuden se vuelve imbatible. Transformar los "chats informativos" en **Sistemas de Inteligencia Autónoma y Predictiva**.

1.  ✅ **Agentes Autónomos Transaccionales (Action Agents) vía n8n:**
    **COMPLETADO.** Se dotó a la IA de herramientas (Tools) para ejecutar acciones reales. Usando **n8n como middleware orquestador**, la IA detecta la intención (ej. *"Quiero agendar una cita"*), emite una etiqueta JSON estructurada (`[TOOL_CALL: ...]`), y el servidor de Kuden intercepta el comando, inyecta datos del CRM en tiempo real (Tenant, Campaña, Contacto) y gatilla el flujo en n8n. El resultado se re-inyecta en el LLM para responder al usuario. Se integraron "Safety Rules" robustas en el Prompt Maestro para evitar la ejecución duplicada de herramientas si la confirmación ya existe en el historial. Kuden no solo chatea, **Kuden opera**.
2.  ✅ **Copiloto en Vivo para Humanos (Agent Assist):**
    Completado. Botón "Sugerencia IA" implementado en el CRM. Cuando el ejecutivo hace *Takeover*, la IA entra en acción sugiriendo un texto de respuesta a la conversación que el ejecutivo puede revisar y modificar antes de enviar, reduciendo el TMO drásticamente.
3.  **Análisis Predictivo Proactivo de Fuga (Churn Prediction):**
    El sistema escanea la Vista 360° de los contactos. Si un cliente acumula interacciones frustradas en varios canales, el dashboard dispara una alerta roja y puede enviar automáticamente un correo/WhatsApp de retención *antes* de que el cliente decida irse.
4.  **Entrenamiento RAG "Auto-Didacta":**
    Si la IA escala un caso desconocido a un humano, se quedará "mirando" cómo el experto humano lo resuelve. Al final, propondrá automáticamente: *"¿Deseas agregar esta resolución a mi memoria para la próxima vez?"*.
5.  **Agentes de Voz Outbound (Clonación y Realismo):**
    Conectar el motor lógico a tecnologías tipo ElevenLabs. En lugar de solo procesar voz, Kuden podrá realizar llamadas telefónicas (Outbound) a listas de morosos o prospectos con una voz ultra-realista que adapta su empatía en vivo.
6.  **A/B Testing Automático de "Perfiles IA":**
    Para clientes de ventas, Kuden probará el perfil "Vendedor Consultivo" vs "Vendedor Urgencia". El panel reportará qué psicología convierte más ventas, basando nuestra asesoría en datos duros.
7.  **Traducción y Multilingüismo en Tiempo Real:**
    El cliente en Brasil escribe en portugués, el ejecutivo chileno de tu cliente lo lee en español y responde en español. Kuden se encarga de re-traducir a nivel sistémico de forma invisible.
11. ✅ **Agente Asesor IA Interno (Co-Piloto Corporativo):**
    **COMPLETADO:** Se construyó un módulo interactivo (CopilotManager) para administradores y ejecutivos autorizados (controlado vía RLS y flag `copilot_access`). Kimi actúa como consultora interna privada para cada Tenant, inyectando de forma transparente la Base de Conocimiento (RAG) de la empresa y métricas operacionales detalladas en tiempo real (Top 5 contactos más activos del día, rendimiento desglosado por campaña, casos abiertos/cerrados, entre otros) directamente en su System Prompt con un sistema de prevención de caídas (`try/catch` conectado al Health Monitor). Esto la convierte en un verdadero "ChatGPT Corporativo" altamente resiliente que apoya estratégicamente en el día a día.
9.  **Alertas Automáticas y Escalación Proactiva (Vía n8n):**
    Si la IA detecta a un cliente VIP con riesgo de fuga ALTO, el sistema no solo lo muestra en el dashboard, sino que envía una alerta push inmediata al supervisor vía Slack o WhatsApp, permitiendo salvar la cuenta en minutos.
10. ✅ **Dashboard de Salud del Sistema (Monitoring Interno):**
    Las tablas de `audit_logs` están creadas en Supabase y el helper `insertAuditLog` registra eventos críticos y errores. **COMPLETADO:** Se construyó el panel `SystemHealthDashboard` nativo en el área SuperAdmin. Este módulo lee logs en tiempo real, genera gráficos de distribución temporal, cuenta con KPI dinámicos de severidad (excluyendo alertas resueltas) y permite marcar errores críticos como "Resueltos" (quedando tachados y con opacidad reducida). Integra a la mascota Kimi para alertar visualmente sobre el estado de salud del sistema, eliminando definitivamente la necesidad de depender de plataformas externas como Zabbix o Sentry.
11. **Panel de Insights Predictivos (Analítica Macro y Evaluación de Desempeño):**
    Una IA que funciona como el Analista de Datos Jefe del negocio. Lee miles de reportes mensuales de forma agregada para dar conclusiones estratégicas al gerente (Ej: *"El 40% de la fuga este mes provino de fallas en la pasarela de pagos"*). Además, evalúa el **desempeño humano**: genera rankings automáticos de los ejecutivos basados en CSAT, TMO y cierres; compara su evolución mes a mes frente a sus pares, e identifica a los mejores talentos para planes de incentivos o capacitación. Un verdadero *Business Intelligence* conversacional.
