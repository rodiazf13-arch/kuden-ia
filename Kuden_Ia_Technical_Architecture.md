# Arquitectura Técnica de Kuden IA 
*Documento Oficial de Ingeniería - Actualizado a Junio 2026*

Este documento describe la arquitectura interna, stack tecnológico y flujos de datos de Kuden IA. Está diseñado como una guía de referencia (Wiki) para desarrolladores, auditores y arquitectos de software.

---

## 1. Topología del Sistema y Stack Tecnológico

Kuden IA emplea una arquitectura moderna, modular y **Stateless** (Sin estado en memoria), lo que garantiza escalabilidad horizontal.

*   **Frontend:** React 18 + Vite (Empaquetado PWA). SPA (Single Page Application).
*   **Backend:** Node.js + Express.js. API RESTful. Caché de alta velocidad en Redis.
*   **Base de Datos & Auth:** Supabase (PostgreSQL + PgVector con HNSW para RAG + Storage).
*   **Middleware & Orquestación:** n8n (Manejo de Webhooks, OAuth, Integraciones).
*   **LLM Provider:** Anthropic Claude (Sonnet 4.6 / Haiku 4.5) o genéricos, inyectados vía Prompt System dinámico.

### 1.1. Patrón Arquitectónico: El "Hub Central"
El Backend (`server.js`) actúa como la única fuente de verdad y enrutador maestro. 
- Los clientes (Web/PWA) consumen las APIs REST del Backend.
- Los canales externos (Email, WhatsApp, Instagram) NUNCA hablan directo con el Backend; siempre pasan por **n8n** como Middleware puente, que extrae, sanitiza y convierte la data, antes de enviarla vía HTTP Webhook a Kuden.

---

## 2. Capa Frontend (Vite + React)

Ubicado en la carpeta `frontend/`, es una aplicación React renderizada del lado del cliente.

### 2.1. Estructura de Directorios Clave (`frontend/src/`)
*   `/admin`: Contiene las vistas del Dashboard (CRM, Knowledge Base, Settings).
*   `/api`: Clientes Axios y endpoints exportados para llamadas al backend.
*   `/auth`: Vistas de Login, Registro y recuperación.
*   `/lib`: Funciones utilitarias (formatters de fecha, parsers de markdown).

### 2.2. Componentes y Módulos Principales
*   `App.jsx`: Maneja el ruteo (React Router DOM) y protege las rutas validando el JWT. Funciona como un **Bus de Eventos Global** (ej. escuchando eventos custom `changeTab` para coordinar saltos automáticos entre módulos disjuntos como Contactos y CRM).
*   `DashboardLayout.jsx`: Es el layout padre. Maneja la barra lateral (Sidebar), el modo oscuro/claro (CSS Variables), y la lógica PWA (Botón "Instalar App"). En móviles, oculta la barra y expone un menú hamburguesa.
*   `CRMManager.jsx`: El corazón de la operación. Implementa un **Kanban Reactivo** de conversaciones, paneles de métricas interactivos (clic en un gráfico filtra la bandeja), y un panel de chat en tiempo real a la derecha. Soporta precarga automática de chats (`kuden_open_conv_id` en localStorage).
*   `ContactsManager.jsx` y `Contact360View.jsx`: Gestor de Leads a nivel macro. Soporta filtrado de estados y métricas. Desde la vista 360 se invocan las conversaciones Outbound (salientes) que generan registros silenciosos e inyectan al usuario directamente en el CRM.
*   `CopilotManager.jsx`: Interfaz de chat con Kimi.
*   `IntegrationsHub.jsx`: Panel de configuración de conectores (Google Calendar, Outlook, WhatsApp). Aquí el administrador pega las credenciales que alimentarán los flujos de n8n.
*   `AIConfigManager.jsx`: Identidad Maestra. Pantalla superadmin para gestionar los proveedores LLM internos (Kimi y Resúmenes). Incluye el **Buzón de Entrenamiento Auto-Didacta (RAG)** para aprobar/rechazar sugerencias extraídas de conversaciones y asignarlas a perfiles IA específicos.
*   `KimiInsights.jsx` y `SystemHealth.jsx`: Dashboards de BI y monitoreo técnico de uso exclusivo (SuperAdmin y Managers). KimiInsights utiliza `recharts` para curvas de área y soporta exportación de reportes a Word (.doc).
*   `KimiMascot.jsx`: Componente global persistente en la UI que interactúa visualmente con el usuario, simulando el "cerebro" de la plataforma.
*   `KimiWidget.jsx`: Widget global flotante de asistencia (Agent Assist interno). Mantiene estado de apertura y tiene consciencia espacial al detectar cambios de pestaña (`currentTab`) para inyectar este `appContext` al LLM en `server.js` de forma invisible.

### 2.3. Estilos y Diseño Responsivo
Se utiliza CSS Vanilla puro en `index.css`. Se basa en variables CSS (`--bg-main`, `--text-main`) para inyectar dinámicamente colores de Tenant (Marca blanca) y soportar Dark Mode. Usa Flexbox/Grid y `@media queries` para la adaptabilidad a dispositivos móviles.

---

## 3. Capa Backend (Node.js / Express)

Ubicado en la carpeta `backend/`. Todo se orquesta a través de `server.js` corriendo en el puerto 3001.

### 3.1. Servicios Core (`/backend/*.js`)
*   `server.js`: El monolito. Inicializa Express, carga CORS, expone todas las rutas (`/api/crm`, `/api/chat`, `/api/auth`, `/api/webhook`) e interactúa con el SDK de Supabase. Implementa el **Gatekeeper Transaccional** para validar action locks antes de invocar herramientas en n8n. Contiene hooks asíncronos como `generateExecutiveSummary` y `generateRAGSuggestion` para operaciones post-cierre y aprendizaje auto-didacta.
*   `redisClient.js`: Capa de caché efímera conectada a una instancia de Redis. Administra el estado en memoria de las conversaciones (`conv_history:*`) para inyectar el contexto al LLM en milisegundos sin sobrecargar PostgreSQL.
*   `llmService.js`: Encargado de hablar con la API del LLM. Posee la lógica para inyectar el RAG (Contexto de la empresa), el Tono del Asistente y decidir las herramientas (Tools) a usar. **Soporta modelos disociados** (ej. Sonnet para el copiloto, Haiku para resúmenes).
*   `ragService.js`: Recibe textos, los divide en *Chunks* usando técnicas heurísticas, genera el Vector Embedding (fijado en 768 dimensiones) y hace el `INSERT` en PgVector. También hace la consulta de similitud del coseno al recuperar.
*   `queueWorker.js` *(Opcional)*: Encargado de procesar tareas asíncronas pesadas (ej. vectorización masiva) usando `supabase_queue` si se activa la persistencia asíncrona.
*   `updateContactMetricsByConversation` (Lógica delegada): Trigger/Función middleware que recalcula promedios de CSAT (`nps_historico`) y el conteo de incidentes de fugas tras el cierre de cualquier conversación, volcando los resultados como datos cacheados en la tabla `contacts` para su consumo rápido en Vistas de Mando.

### 3.1.1 Endpoints Destacados y de Orquestación
*   `/api/setup/magic-onboarding`: Extrae texto de PDFs (usando `pdf-parse` mediante `createRequire` para soporte ESM), genera un JSON arquitectónico vía LLM y crea iterativamente los sub-perfiles en base de datos.
*   `/api/insights/macro`: Agrupa matemáticamente las conversaciones por `campaign_id` y por fecha (para gráficos de series de tiempo), evalúa los CSAT y genera métricas de retención sin depender del LLM para el cálculo matemático.

### 3.2. Webhooks Estratégicos (Ingesta de Datos)
El sistema expone Endpoints públicos protegidos por Tokens internos para que n8n inyecte datos:
*   `POST /api/webhook/n8n-email`: Recibe payloads estructurados desde correos. Parsea el "Message-ID" para lograr Threading, y guarda arreglos de URLs (`attached_files`) si venían archivos adjuntos transformados desde Base64.
*   `POST /api/webhook/whatsapp`: Estructura similar al email, pero mapea el número de teléfono como identificador único de Lead.

---

## 4. Middleware e Integraciones (n8n)

Se optó por no sobrecargar a Kuden con la complejidad técnica de APIs de terceros (Autenticación OAuth de Google, IMAP de correos, Graph API de Meta).

### 4.1. Filosofía del Puente "n8n"
Todos los flujos JSON de automatización viven en un servidor n8n dedicado.
*   **Ejemplo Inbound (Email):** El nodo IMAP de n8n escucha correos > Un nodo código extrae PDF/Imágenes y las convierte a texto/Base64 > Un nodo HTTP Request envía un POST a Kuden.
*   **Ejemplo Outbound (Email):** Kuden genera un ID de Ticket unívoco (`KUD-XXXXXX`) > El backend dispara un Webhook Inbound de n8n (`/webhook/kuden-outbound`) con el texto, ticket ID y las URLs de adjuntos > n8n descarga en memoria los binarios de esas URLs > n8n usa el nodo nativo de Gmail para enviar el correo y evitar bloqueos de Spam.

### 4.2. Action Agents (Tool Calling Autónomo)
Cuando el LLM determina que el usuario quiere ejecutar una acción (ej. agendar cita), el `llmService.js` genera una instrucción estructurada y dispara un Webhook a n8n (`n8n_stage_change_webhook_id` u otros triggers de herramientas) inyectando el ID del Tenant y la intención. n8n ejecuta la transacción externa y Kuden se limita a registrar el hito en el CRM.

---

## 5. Capa de Datos (Supabase / PostgreSQL)

Almacenamiento relacional, authtenticación basada en JWT, y almacenamiento vectorial en una sola plataforma.

### 5.1. Esquema Relacional Principal
*   `tenants`: Entidades comerciales. Campos: `id`, `name`, `assistant_prompt` (instrucciones base), `llm_provider`, configuraciones de Webhooks de n8n.
*   `tenant_users`: Los ejecutivos/administradores de la plataforma. Relación M:1 con `tenants`.
*   `agent_groups`: Grupos operativos (Ej. Nivel 1, Ventas VIP).
*   `agent_group_users`: Relación N:M que define la pertenencia de un `tenant_user` a un `agent_group`.
*   `campaigns`: Los temas o departamentos lógicos.
*   `campaign_groups`: Relación N:M que autoriza a un `agent_group` a atender conversaciones de una `campaign`. Soporta `is_default` para enrutamiento inicial automático.
*   `contacts`: Listado global de contactos. Almacena las propiedades demográficas y columnas cacheadas de BI como `nps_historico` y `riesgo_fuga` (que se auto-calculan a partir de la historia transaccional).
*   `conversations` (Leads): Los tickets/chats de contacto. Campos: `id`, `tenant_id`, `contact_id`, `status` (Etapa del Kanban), `canal`, `campaign_id`, `assigned_group_id` (Grupo asignado), `assigned_to` (Ejecutivo), `ticket_id` (ID autogenerado para rastreo), `resumen_ejecutivo`.
*   `conversation_messages`: Los mensajes de cada conversación. Campos: `conversation_id`, `sender` (user/agent/system), `content` (Texto), `attached_files` (Array JSON), `timestamp`.
*   `knowledge_documents` & `document_chunks`: Base RAG. `document_chunks` utiliza el índice **HNSW** (`vector_cosine_ops`) sobre vectores fijos de 768 dimensiones para garantizar velocidad de recuperación a gran escala.
*   `rag_suggestions`: Tabla para el entrenamiento auto-didacta (Human-in-the-loop). Almacena pares de Pregunta/Respuesta sugeridos por el LLM tras analizar la intervención de ejecutivos humanos. Campos: `id`, `tenant_id`, `ai_profile_id`, `suggested_question`, `suggested_answer`, `status`.
*   `agent_action_locks`: Tabla de control transaccional (Gatekeeper) que registra un hash único por cada herramienta invocada por el LLM para el inquilino/contacto, previniendo acciones duplicadas.
*   `audit_logs`: Trazabilidad técnica. Usado por el System Health Dashboard.

### 5.2. Almacenamiento de Archivos (Supabase Storage)
*   **Bucket `chat_attachments`**: Almacena todos los archivos PDF, Imágenes, o Audios intercambiados en las conversaciones, tanto Inbound como Outbound. Todo archivo se sirve a través de la URL pública/firmada para el frontend.

### 5.3. Seguridad
*   **RLS (Row Level Security):** Todas las tablas exigen que el usuario envíe su JWT, filtrando implícitamente por `tenant_id` en la base de datos para garantizar el aislamiento mutuo de clientes (Multi-tenancy seguro).

---

## 6. Integración PWA y App Móvil
Kuden incorpora `vite-plugin-pwa` generando automáticamente `sw.js` (Service Workers) y `manifest.webmanifest`. 
*   **Manejo Offline/Cache:** Precarga assets estáticos (`index.css`, `main.js`).
*   **Instalación Manual:** Se maneja el evento `beforeinstallprompt` en `DashboardLayout.jsx` para ofrecer un botón nativo de "Instalar App" para navegadores restrictivos (ej. Edge Android).
