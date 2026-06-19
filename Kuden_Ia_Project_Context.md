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
*   ✅ **Extracción de Datos (El CRM Invisible):** La IA inyecta silenciosamente etiquetas `[METADATOS]` que el servidor intercepta para crear registros en `ContactsManager` automáticamente.
*   ✅ **Bandeja de Ejecutivos (`CRMManager`) y Pipeline Kanban:** Interfaz para humanos con *Takeover* (Toma de control del bot), vista de columnas Kanban colapsables con ordenamiento persistente, paneles de sentimiento en tiempo real e indicadores de riesgo de fuga. **(Actualizado)**: El chat ahora incluye un editor de texto multilínea enriquecido (textarea) con atajos (Ctrl+Enter), soporte nativo para **Emojis**, subida de **Archivos Adjuntos** directamente a Supabase Storage y gestión de **Firmas de Correo** personalizables por usuario. Además, las tarjetas de conversación (tanto en lista como en Kanban) cuentan con **fondos y bordes dinámicos semitransparentes (colores pastel) según el canal de origen** (WhatsApp, Email, Instagram, Webchat), habiendo unificado internamente el canal web bajo el ID estandarizado `webchat` para una identificación visual rápida y sin conflictos de estado.
*   ✅ **Gatillos de Automatización y Webhooks (n8n):** Sistema de eventos de fondo (background events) que intercepta los cambios de etapa en la conversación y emite un payload estructurado hacia flujos específicos de n8n, actuando como puente entre las decisiones de la IA y el ecosistema operativo del cliente.
*   ✅ **Web Chat Automático:** Script embebible (`kuden-widget.js`) con interfaz resiliente, que maneja estados de sesión y cierra activando la encuesta CSAT automáticamente.
*   ✅ **Multi-Tenancy Genuino:** Gestión de clientes respaldada por PostgreSQL/Supabase, blindada con Row Level Security (RLS) para aislamiento de datos.
*   ✅ **Módulo de Reportería Avanzada:** Panel de gráficos integrados (Recharts) en el CRM para visualizar rápidamente el Sentimiento y Riesgo de Fuga de las conversaciones, incluyendo **filtros dinámicos por Campaña**.
*   ✅ **Gestor Multi-LLM, OpenRouter y Tarificador Avanzado:** Abstracción en backend que permite usar los proveedores nativos (Anthropic, OpenAI, Google, Groq) más la integración oficial con **OpenRouter**, dando acceso a cientos de modelos (LLMs) a través de una única API Key centralizada. Panel de facturación (`BillingDashboard.jsx`) con filtros avanzados por **Empresa (Tenant)** y **Rango de Fechas**, multiplicador de margen de ganancia de IA (`llm_markup_multiplier`) y función de **Exportación a CSV** para agilizar la facturación mensual a clientes.
*   ✅ **Arquitectura White-Label Dinámica:** Capacidad de inyectar colores corporativos y logos personalizados por empresa desde el gestor multi-tenant (`TenantsManager.jsx`), asegurando una estética premium con Glassmorphism compatible en modo claro y oscuro.
*   ✅ **Soporte Multi-Industria:** Las plantillas de Tenant se adaptan dinámicamente insertando custom fields específicos para inmobiliarias, salud, cobranzas o soporte.
*   ✅ **Sistema de Suplantación Superadmin ("Done-For-You" Genuino):** Capacidad en tiempo real (`DashboardLayout.jsx` + `App.jsx`) para que los superadministradores de Kuden puedan visualizar toda la plataforma y operar el CRM, Simulador y Perfiles exactamente como si fueran uno de sus clientes, sin perder sus privilegios maestros y sin fugas de estado entre sesiones. Esto facilita enormemente la gestión y el soporte integral de la plataforma.
*   ✅ **Selector Dinámico de Destino para Plantillas IA:** El sistema permite que los superusuarios decidan inyectar perfiles IA directamente a empresas cliente específicas, o convertirlas en "Plantillas Kuden" globales (de solo lectura), logrando una gobernanza total sobre las personalidades de la IA.
*   ✅ **Rediseño Visual (Premium SaaS UI/UX):** Implementación de tipografías modernas (Outfit/Inter), glassmorphism, gradientes inteligentes adaptables al modo nocturno, sombras suaves, micro-interacciones globales y componentes de usabilidad avanzados (como un **Selector Visual de Íconos** interactivo para la gestión de Perfiles IA) para una experiencia de usuario de alto nivel.
*   ✅ **Base del Sistema RAG y Agent Assist ("Botón Mágico"):** Motor de embeddings (`ragService.js`) conectado a Supabase `pgvector`, permitiendo a los ejecutivos pedir a la IA sugerencias de respuesta en tiempo real basadas en documentos almacenados.
*   ✅ **Gestión de Usuario y Login Premium:** Componente de autogestión de seguridad para cambios de contraseña. La pantalla de Login fue rediseñada con efectos *Glassmorphism*, gradientes profundos y el logo oficial de la marca, dando una experiencia *Enterprise* desde el primer segundo.
*   ✅ **Control de Accesos Dinámico (Role-Based Visibility):** El menú lateral oculta módulos de uso interno (ej. *Simulador IA*, *Tarificador*, *Health Monitor*) a clientes regulares, manteniendo la interfaz limpia y enfocada en el producto terminado.
*   ✅ **Resiliencia del Frontend (Crash Prevention):** Manejo robusto de errores asíncronos y latencias de estado (ej. carga del `tenantId`) en `CRMManager.jsx`, interceptando errores HTTP 500 y retornando estados vacíos seguros para prevenir pantallas en blanco ("White Screen of Death") tras el login.
*   ✅ **Enrutamiento Inteligente y Sidebar:** Menú lateral categorizado por áreas de negocio (Operaciones, Motor IA, Admin) y aterrizaje directo post-login en el Dashboard de Reportes para decisiones de negocio inmediatas.

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
3.  **Hub de Conexión OAuth para Agendamientos e Integraciones (Delegación a n8n):**
    *   **Regla de Arquitectura (Cero Reinvención):** Kuden NO construirá un motor de calendarios interno (manejo de zonas horarias, disponibilidad, etc.). Toda la carga transaccional y validación de fechas se delega exclusivamente a **n8n** interactuando con herramientas nativas del cliente.
    *   ✅ **Frontend UI Completado (Hub de Integraciones):** Se construyó el componente visual premium (`IntegrationsHub.jsx`) en el panel de administración bajo la sección "Integraciones & Web". Incluye las interfaces de conexión para **Google Calendar, Outlook Calendar, Calendly, Cal.com, Meta WhatsApp Cloud e Instagram Direct**. Kuden capturará el Token de seguridad desde aquí y lo inyectará directamente en n8n. (Pendiente: Lógica OAuth backend).

---

## 4. FASE 5: Horizonte de Innovación (La Ventaja Competitiva Absoluta)

Aquí es donde Kuden se vuelve imbatible. Transformar los "chats informativos" en **Sistemas de Inteligencia Autónoma y Predictiva**.

1.  ✅ **Agentes Autónomos Transaccionales (Action Agents) vía n8n:**
    **COMPLETADO.** Se dotó a la IA de herramientas (Tools) para ejecutar acciones reales. Usando **n8n como middleware orquestador**, la IA detecta la intención (ej. *"Quiero agendar una cita"*), emite una etiqueta JSON estructurada (`[TOOL_CALL: ...]`), y el servidor de Kuden intercepta el comando, inyecta datos del CRM en tiempo real (Tenant, Campaña, Contacto) y gatilla el flujo en n8n. El resultado se re-inyecta en el LLM para responder al usuario. Se integraron "Safety Rules" robustas en el Prompt Maestro para evitar la ejecución duplicada de herramientas si la confirmación ya existe en el historial. Kuden no solo chatea, **Kuden opera**.
2.  ✅ **Copiloto en Vivo para Humanos (Agent Assist):**
    Completado. Botón "Sugerencia IA" implementado en el CRM. Cuando el ejecutivo hace *Takeover*, la IA entra en acción sugiriendo un texto de respuesta a la conversación que el ejecutivo puede revisar y modificar antes de enviar, reduciendo el TMO drásticamente.
3.  **Análisis Predictivo Proactivo de Fuga (Churn Prediction):**
    El sistema escanea la Vista 360° de los contactos. Si un cliente acumula interacciones frustradas en varios canales, el dashboard dispara una alerta roja y puede enviar automáticamente un correo/WhatsApp de retención *antes* de que el cliente decida irse.
4.  ✅ **Entrenamiento RAG "Auto-Didacta" (Human-in-the-loop):**
    **COMPLETADO:** Se construyó un sistema de aprendizaje continuo. Un hook asíncrono en el backend analiza los tickets cerrados con intervención humana. Si detecta una nueva política o solución, genera un par Pregunta/Respuesta y lo envía a un Buzón en la vista "Identidad Maestra" (`AIConfigManager.jsx`). El superadministrador revisa, selecciona un Perfil IA de destino y al aprobar, la sugerencia se convierte en Markdown y se vectoriza automáticamente en Supabase `pgvector`, mejorando el conocimiento de la IA para futuros casos sin riesgo de alucinación.
5.  **Integración Asíncrona de Voz Outbound (VICIdial + AI):**
    **Regla de Arquitectura (Desacoplamiento):** Kuden NO construirá un motor SIP/VoIP interno. La marcación y el diálogo en vivo se delegan a la infraestructura experta (ej. VICIdial conectado a Retell AI). Al finalizar la llamada, el sistema inyecta vía Webhook la transcripción y el resumen directamente en el CRM de Kuden como un evento de voz. Esto alimenta la **Vista 360°** sin heredar la latencia y complejidad del streaming de audio en tiempo real.
6.  **A/B Testing de "Perfiles IA" (Basado en Recomendación, no Automático):**
    Para clientes de ventas, Kuden probará el perfil "Vendedor Consultivo" vs "Vendedor Urgencia". **Riesgo:** Apagar perfiles automáticamente sin volumen estadístico significativo puede arruinar campañas (falsos positivos). **Regla de Arquitectura:** El sistema generará reportes vía Kimi Insights sugiriendo el perfil ganador, pero la decisión de cambio será siempre manual por parte del administrador.
7.  **Traducción y Multilingüismo en Tiempo Real:**
    El cliente en Brasil escribe en portugués, el ejecutivo chileno de tu cliente lo lee en español y responde en español. Kuden se encarga de re-traducir a nivel sistémico de forma invisible.
8.  ✅ **Inteligencia Interna Desacoplada (Kimi Co-Piloto & Analista de Resúmenes):**
    **COMPLETADO:** Se construyó un panel `superAdminOnly` ("Identidad Maestra") exclusivo para Kuden, enfocado en optimizar el costo y rendimiento de las tareas operativas. Permite asignar proveedores y modelos totalmente independientes para **Kimi Co-Piloto** (ej. modelos de alto razonamiento como Sonnet) y para el **Analista de Resúmenes** al cerrar tickets (ej. modelos veloces y económicos como Haiku o Flash). Kimi actúa como consultora interna privada para cada Tenant, inyectando de forma transparente la Base de Conocimiento (RAG) de la empresa y métricas operacionales detalladas en tiempo real en su System Prompt, convirtiéndola en un verdadero "ChatGPT Corporativo".
9.  **Alertas Automáticas y Escalación Proactiva (Vía n8n):**
    Si la IA detecta a un cliente VIP con riesgo de fuga ALTO, el sistema no solo lo muestra en el dashboard, sino que envía una alerta push inmediata al supervisor vía Slack o WhatsApp, permitiendo salvar la cuenta en minutos.
10. ✅ **Dashboard de Salud del Sistema (Monitoring Interno):**
    Las tablas de `audit_logs` están creadas en Supabase y el helper `insertAuditLog` registra eventos críticos y errores. **COMPLETADO:** Se construyó el panel `SystemHealthDashboard` nativo en el área SuperAdmin. Este módulo lee logs en tiempo real, genera gráficos de distribución temporal, cuenta con KPI dinámicos de severidad (excluyendo alertas resueltas) y permite marcar errores críticos como "Resueltos" (quedando tachados y con opacidad reducida). Integra a la mascota Kimi para alertar visualmente sobre el estado de salud del sistema, eliminando definitivamente la necesidad de depender de plataformas externas como Zabbix o Sentry.
11. ✅ **Panel de Insights Predictivos (Kimi Insights BI):**
    **COMPLETADO:** Se ha creado un panel de Inteligencia de Negocios de arquitectura híbrida. Por un lado, el backend compila matemáticamente (0% error) el **Rendimiento de Ejecutivos**, agrupando CSAT, volumen de casos cerrados y distribución de riesgos, armando un Ranking Exacto. Por el otro lado, Kimi lee esta data cruda y redacta un **Análisis Estratégico Ejecutivo** altamente persuasivo, detectando anomalías y felicitando el buen rendimiento. El informe interactúa con el tarificador oficial (generando facturación extra por inteligencia) y la interfaz fue diseñada bajo la filosofía visual de Kuden, mostrando la matemática pura junto al análisis humanoide, otorgando total confianza al usuario gerencial.
12. ✅ **Pipeline Kanban Inteligente y Gatillos de Automatización (n8n Webhooks):**
    **COMPLETADO:** Se ha implementado un tablero Kanban visual (`CRMManager`) con columnas colapsables donde los leads se mueven **automáticamente** entre etapas (Tipificaciones) según la intención que la IA detecta en el chat, o mediante cambios manuales del ejecutivo. Este pipeline está conectado de forma nativa a **n8n** a través de un ID de Webhook dedicado (`n8n_stage_change_webhook_id`). Al cambiar de etapa, se dispara un evento asíncrono y estructurado (`STAGE_CHANGED`) en tiempo real hacia n8n, permitiendo automatizar flujos post-contacto (ej. enviar presupuestos por correo, enrolar en secuencias) sin latencia en la conversación. Convierte a Kuden en un motor de ventas end-to-end.
13. **Follow-Up Automático (Nurturing Inteligente):**
    Secuencias configurables (ej. recontacto a los 3 días) donde la IA retoma la conversación con leads fríos de forma proactiva, recordando el contexto anterior para re-engancharlos y aumentar la conversión sin intervención humana.
14. **Gamificación y Leaderboards para Ejecutivos:**
    Aprovechar los datos base de Kimi Insights para crear un tablero en vivo con medallas (ej. "Mejor CSAT", "Resolución Ultra Rápida"). Convierte la atención al cliente en un entorno motivador y competitivo, reduciendo la rotación de personal en contact centers.
15. **Cobros y Links de Pago en el Chat:**
    La IA detecta la intención de compra y genera automáticamente un link de pago (Transbank, Mercado Pago, Stripe) enviándolo dentro de la misma conversación para cerrar ventas sin fricción.
16. **SLA Monitor con Alertas de Incumplimiento:**
    Timer automático para asegurar acuerdos de nivel de servicio (ej. "respuesta en 2 horas"). Dispara alertas urgentes a supervisores antes de que el SLA se venza.
17. ✅ **App Móvil Ligera para Ejecutivos (Responsividad -> PWA -> Tiendas):**
    **COMPLETADO (Fase 1 y 2):** Adaptación responsiva total de la vista web actual para uso fluido en móviles/tablets. Conversión a Progressive Web App (PWA) para instalación rápida sin tiendas. Empaquetado futuro para publicación oficial en App Store y Google Play para mayor autoridad de marca.
18. ✅ **Canal de Email Integrado Bidireccionalmente (Vía n8n):**
    **COMPLETADO:** Para evitar el costoso y burocrático proceso del "Google CASA Security Assessment" (Auditoría anual de $15,000 USD+ requerida por Google para leer bandejas de entrada directamente por API), la arquitectura Kuden utiliza **n8n como middleware puente**. 
    *   **Flujo Inbound:** Un workflow en n8n escucha la bandeja de entrada del cliente (ej. vía IMAP o Gmail node). Al recibir un correo, extrae asunto, texto y Message-ID. Adicionalmente, extrae dinámicamente cualquier **Archivo Adjunto** binario, lo convierte a *base64* y dispara un Webhook Inbound (`POST /api/webhook/n8n-email`) hacia Kuden. Kuden inserta el contacto, inicia el hilo, reconstruye los adjuntos subiéndolos a su bucket `chat_attachments` y muestra las URLs en la conversación.
    *   **Flujo Outbound:** El administrador del Tenant configura su propia URL de "Outbound Email Webhook" en el **Hub de Integraciones**. Cuando el ejecutivo responde desde el CRM, Kuden dispara la URL pasando el texto (transformando saltos de línea a `<br>` para formato HTML), el `messageId` y un array con las URLs de los **Archivos Adjuntos**. En n8n, un nodo de Código (JavaScript) descarga dinámicamente estos archivos a memoria binaria (`this.helpers.request`) y se los inyecta dinámicamente al nodo de Gmail nativo para despachar el correo con los archivos adjuntos reales, asegurando el Threading correcto y manteniéndose "Stateless".
19. **Formularios y Encuestas Personalizables Conversacionales:**
    La IA recopila datos específicos (presupuesto, tipo de propiedad) mediante conversación natural en lugar de formularios fríos, guardando todo estructurado en el CRM.
20. **Portal de Autoservicio para Clientes Finales:**
    Mini-portal donde el cliente final ingresa con su RUT/email para ver el estado de sus tickets, historial y documentos compartidos, reduciendo la carga operativa en un 30-50%.
21. **API Pública + Webhooks para Integraciones:**
    API REST para conectar Kuden con ERPs o sistemas contables legacy de grandes corporativos, disparando webhooks ante eventos clave (ej. "nuevo lead calificado").
22. **Simulador Kimi "Red Team" (Entrenamiento de Perfiles IA):**
    Entorno de simulación donde Kimi adopta personalidades desafiantes (ej. "Cliente Furioso", "Indeciso", "Troll") y chatea automáticamente contra un Perfil IA recién creado. Entrega un reporte de estrés para validar que el agente responde correctamente a casos borde antes de salir a producción.
23. **"Shadow Kimi" (Auditoría de Calidad - QA Ciega al 100%):**
    Un hook asíncrono evaluará cada conversación cerrada por un humano (no bot) usando un LLM rápido. Comparará la atención dada contra el Manual de Procedimientos (RAG) y el Tono de Marca, generando un "QA Score" automático. Detectará si el humano fue cortés, resolutivo o si ofreció el upsell correcto, creando un Dashboard de Calidad total para los gerentes.
24. **Generación de Leads Outbound Autónomo (Escucha Social Activa):**
    Mediante n8n, Kuden escuchará en tiempo real APIs de redes sociales (ej. grupos de Facebook, Instagram, Reddit) buscando palabras clave o intenciones de compra relacionadas al negocio del cliente. Al detectar un lead potencial, Kuden enviará un DM automático y consultivo, transformando la plataforma de un centro reactivo a un motor activo de generación de ingresos.
25. **Módulo Autónomo de Marketing y Publicaciones en Redes Sociales (Social Media Engine):**
    Integración proactiva con Instagram, Facebook, LinkedIn y TikTok. Kimi ayudará a los dueños de PyMEs a redactar posts atractivos y publicar promociones directamente desde la plataforma. Además, la IA leerá los comentarios e interacciones de las publicaciones en tiempo real para generar un **Análisis de Sentimiento de Producto**, y creará formularios de prospección automáticos. Si un cliente comenta interesado en una promoción, Kuden IA o los ejecutivos humanos podrán continuar la atención en el CRM, unificando marketing y ventas bajo un mismo techo.


## Actualización PWA y Móvil (Punto 5.17 del Roadmap)
- **COMPLETADO:** Se implementó  ite-plugin-pwa para convertir Kuden IA en una aplicación instalable (Progressive Web App).
- Se agregaron íconos PWA generados a partir del logo oficial en rontend/public/.
- **Diseño Móvil (UI/UX):** Se rediseñó el DashboardLayout.jsx integrando un overlay y un menú tipo Hamburguesa (☰) para pantallas chicas.
- El CRM (CRMManager.jsx) ahora maneja estado adaptativo: muestra por defecto la lista de contactos, y al seleccionar un chat, la caja de mensajes ocupa toda la pantalla para asegurar una experiencia tipo aplicación nativa en móviles. Esto logra el Efecto WOW inmediato.

---

## 6. Alertas y Riesgos Arquitectónicos (Consideraciones a Futuro)

> **Nota del Asesor Técnico (Antigravity):** Las siguientes alertas identifican posibles cuellos de botella arquitectónicos a medida que el sistema escala, y deben ser consideradas en futuras iteraciones del Roadmap para garantizar la estabilidad operativa.

1.  **El Cuello de Botella de n8n (Riesgo Crítico de Arquitectura):**
    *   **El Riesgo:** Delegar toda la lógica transaccional, webhooks e emails a n8n lo convierte en nuestro Punto Único de Fallo (SPOF). Su modelo *stateless* manejando adjuntos en memoria puede consumir recursos agresivamente bajo cargas altas (ej. picos de tráfico en clientes corporativos).
    *   **Consideración a Futuro:** Mantener n8n como "Laboratorio de Integraciones" y para canales long-tail. Sin embargo, para canales troncales (WhatsApp, Instagram, Email Inbound), se debe planificar la migración gradual a **microservicios serverless nativos** (ej. Vercel/AWS Lambda) a medida que el volumen lo justifique.

2.  **La Latencia del Modelo "Stateless" con el LLM:**
    *   **El Riesgo:** Siendo Node.js stateless, recuperar el contexto de la conversación (Vista 360) para cada nuevo mensaje implica hacer consultas pesadas (`SELECT`) a PostgreSQL antes de enviarlo al LLM. Esto incrementa la latencia y el tiempo de respuesta (TTFB).
    *   **Consideración a Futuro:** Planificar la implementación de una capa de **caché efímera (como Redis)**. Los últimos mensajes de una sesión activa deben vivir en RAM para que el LLM reciba el contexto en milisegundos y responda fluidamente.

3.  **Vectorización (pgvector) y RLS a Gran Escala:**
    *   **El Riesgo:** Realizar búsquedas vectoriales (cosine similarity) sobre tablas filtradas por Row Level Security (RLS) puede volverse un cuello de botella severo cuando los clientes acumulen miles de documentos en su RAG.
    *   **Consideración a Futuro:** Monitorear rigurosamente los tiempos de query del motor RAG. Preparar la base de datos para utilizar **índices HNSW (Hierarchical Navigable Small World)** optimizados para `pgvector` en lugar de búsquedas secuenciales, garantizando la velocidad de recuperación.

4.  **Action Agents: La Seguridad de la Ejecución Automática:**
    *   **El Riesgo:** Confiar en "Safety Rules" en el Prompt Maestro para evitar acciones duplicadas (ej. procesar dos veces un pago o agendar la misma cita) es inseguro. Los LLMs, por su naturaleza, pueden alucinar y saltarse la regla.
    *   **Consideración a Futuro:** Implementar al backend de Kuden (Node.js) como el **Guardían Transaccional (Gatekeeper)** absoluto. Antes de que el sistema dispare el webhook hacia n8n, debe validar obligatoriamente en la base de datos (ej. un campo `action_status`) que la operación es legítima y no ha sido ejecutada previamente.

---

## 7. Hitos Recientes: Blindaje Arquitectónico (Junio 2026)

Se ejecutó un plan de robustecimiento de infraestructura para mitigar los riesgos arquitectónicos (mencionados en la sección 6):
- **Caché Efímera (Redis):** Se implementó una capa de Redis en el backend (`redisClient.js`) que almacena el historial activo de las conversaciones. El endpoint de chat del widget y la lógica de recuperación del contexto ahora leen desde Redis, reduciendo el TTFB y minimizando las consultas pesadas a PostgreSQL.
- **Gatekeeper Transaccional:** Se introdujo una barrera de seguridad estricta en la intercepción de herramientas (`[TOOL_CALL]`) dentro de `server.js`. Se creó la tabla `agent_action_locks` en Supabase para registrar y validar un hash transaccional antes de invocar a n8n, previniendo ejecuciones duplicadas en caso de alucinaciones del LLM.
- **Optimización de RAG (HNSW):** Se implementó el índice `hnsw` con la métrica `vector_cosine_ops` en la tabla `document_chunks` (fijando la dimensión a 768), asegurando un rendimiento O(log N) para futuras bases de conocimientos a gran escala.

---

## 8. Funcionalidades Core: Eficiencia Operativa (Junio 2026)

- **Ruta B: Onboarding Mágico (Kimi's Tool)**
  - **Estado:** ✅ COMPLETADO
  - **Descripción:** Se implementó una función dentro del chat de la mascota "Kimi" (Co-Piloto) que permite al usuario subir un manual de marca en formato PDF. Kimi analiza el documento y genera, en un formato JSON estructurado, una propuesta arquitectónica de "Perfiles IA" (Agentes), decidiendo automáticamente si se requiere un agente simple o un ecosistema complejo (Agente Maestro Router + Sub-perfiles departamentales). **Actualización:** Se agregó la lógica para que los perfiles creados hereden dinámicamente el Modelo LLM y Proveedor configurado en `tenant_ai_config`. El cliente puede autorizar la creación masiva con un solo clic.

- **Ruta A: Resumen Ejecutivo Automático:**
  - **Estado:** ✅ COMPLETADO
  - **Descripción:** Se implementó una función asíncrona (`generateExecutiveSummary`) que se dispara automáticamente cada vez que una conversación se cierra o se marca como resuelta. El sistema utiliza el modelo LLM configurado en "Identidad Maestra" (`summary_llm_model`) para leer el historial de `conversation_messages` y redactar un resumen estricto de 4 líneas, mostrándolo instantáneamente en la interfaz de `CRMManager.jsx`. Se aplicó una actualización retroactiva a todos los tickets pasados.

- **Ruta C: Kimi Insights (Tablero Directivo / BI):**
  - **Estado:** ✅ COMPLETADO
  - **Descripción:** Se re-diseñó la pantalla de métricas convirtiéndola en un "Command Center" de Inteligencia de Negocios para Ejecutivos. Utiliza Glassmorphism y gráficos interactivos (`recharts`). El backend agrupa las conversaciones por día para mostrar curvas de tendencia de volumen de casos en los últimos 30 días. Incluye filtros interactivos por Campaña, barras de progreso de colores para el CSAT de ejecutivos y la capacidad de descargar el reporte narrativo de IA a formato Microsoft Word (.doc).

- **Ruta D: Kimi Widget Contextual:**
  - **Estado:** ✅ COMPLETADO
  - **Descripción:** Se implementó `KimiWidget.jsx`, una burbuja de chat flotante que acompaña al usuario en toda la plataforma. El widget es "consciente de su contexto" (`appContext`): detecta en qué pantalla está el usuario (ej. "Campañas" o "Perfiles") y le avisa silenciosamente al backend cuando el usuario cambia de pestaña, inyectando esta información en el System Prompt. Esto permite a Kimi dar asesoría técnica y estratégica exacta según la sección que el usuario esté mirando.
