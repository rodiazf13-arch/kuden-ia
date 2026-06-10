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

---

## 2. Bitácora de Desarrollo: Módulos Ya Construidos
La plataforma interna de Kuden ya cuenta con un motor potente listo para operar las cuentas de nuestros clientes:

*   **Motor de Orquestación IA y Perfiles:** Módulo `AIConfigManager` (Agente Maestro) que evalúa intenciones y el `ProfilesManager` que permite que el bot adopte distintas "psicologías" dinámicamente.
*   **Extracción de Datos (El CRM Invisible):** La IA inyecta silenciosamente etiquetas `[METADATOS]` que el servidor intercepta para crear registros en `ContactsManager` automáticamente.
*   **Bandeja de Ejecutivos (`CRMManager`):** Interfaz para humanos con *Takeover* (Toma de control del bot), paneles de sentimiento en tiempo real e indicadores de riesgo de fuga.
*   **Web Chat Automático:** Script embebible (`kuden-widget.js`) con interfaz resiliente, que maneja estados de sesión y cierra activando la encuesta CSAT automáticamente.
*   **Multi-Tenancy Genuino:** Gestión de clientes respaldada por PostgreSQL/Supabase, blindada con Row Level Security (RLS) para aislamiento de datos.
*   **Módulo de Reportería Avanzada:** Panel de gráficos integrados (Recharts) en el CRM para visualizar rápidamente el Sentimiento y Riesgo de Fuga de las conversaciones.
*   **Gestor Multi-LLM y Tarificador:** Abstracción en backend que permite usar los modelos más modernos (Claude 4.6, GPT-5, Gemini 3.5 Flash, Llama 4). Panel de facturación (`BillingDashboard.jsx`) con multiplicador de margen de ganancia de IA (`llm_markup_multiplier`) por tenant.
*   **Arquitectura White-Label Dinámica:** Capacidad de inyectar colores corporativos y logos personalizados por empresa desde el gestor multi-tenant (`TenantsManager.jsx`), asegurando una estética premium con Glassmorphism compatible en modo claro y oscuro.
*   **Soporte Multi-Industria:** Las plantillas de Tenant se adaptan dinámicamente insertando custom fields específicos para inmobiliarias, salud, cobranzas o soporte.
*   **Base del Sistema RAG y Agent Assist ("Botón Mágico"):** Motor de embeddings (`ragService.js`) conectado a Supabase `pgvector`, permitiendo a los ejecutivos pedir a la IA sugerencias de respuesta en tiempo real basadas en documentos almacenados.

---

## 3. ROADMAP TÉCNICO: Escalando la Infraestructura Kuden

Las fases 1 a 4 están diseñadas para robustecer la plataforma interna para que el equipo de Kuden pueda operar múltiples corporativos sin fricción.

### FASE 1: Fundación Arquitectónica y Seguridad
*   ✅ **Multi-Tenancy Genuino (Supabase RLS):** Blindar el aislamiento de datos por *tenant*. Completado.
*   ✅ **Observabilidad Base:** Tablas de logs de auditoría estructuradas. 

### FASE 2: Multicanalidad Oficial y Campañas
1.  ✅ **Estructura de Campañas y Tipificación:** Subdividir clientes en campañas y aplicar perfiles de IA distintos. Completado.
2.  **Meta Tech Provider (Edge Functions):** Proceso oficial de Meta para WhatsApp/Instagram. Arquitectura *Serverless* para recibir cientos de mensajes por segundo sin saturar Node.
3.  **Voz y VICIdial:** Transcripción y análisis de llamadas de voz mediante un microservicio de baja latencia.

### FASE 3: Ecosistema IA, RAG y Vista 360
1.  **Vista 360° Omnicanal:** Unificar la línea de tiempo de un contacto (Web + WhatsApp + Voz) para que el ejecutivo humano y la IA tengan todo el contexto histórico.
2.  ✅ **Gestor Multi-LLM y Tarificador:** Conectar OpenAI, Gemini, Claude, Llama para optimizar costos y tener un panel de márgenes de ganancia. Completado.
3.  ✅ **Sistema RAG (Retrieval-Augmented Generation) Básico:** Motor de embeddings y vectorización completado. *Próximo paso:* Construir la interfaz (UI) para que los clientes puedan subir y gestionar sus propios documentos (PDFs, Web Scraping) fácilmente.

---

## 4. FASE 5: Horizonte de Innovación (La Ventaja Competitiva Absoluta)

Aquí es donde Kuden se vuelve imbatible. Transformar los "chats informativos" en **Sistemas de Inteligencia Autónoma y Predictiva**.

1.  **Agentes Autónomos Transaccionales (Action Agents) vía n8n:**
    Dotar a la IA de herramientas para ejecutar acciones reales. En lugar de codificar integraciones frágiles en el core de Kuden, utilizaremos **n8n como middleware orquestador**. La IA detecta la intención (ej. *"Quiero agendar una cita"*), emite un JSON estructurado hacia nuestro servidor n8n, y n8n se encarga de hablar con los sistemas del cliente (Shopify, Zendesk, Calendly, sistemas médicos, etc.) para insertar o extraer datos. Kuden mantiene su core limpio y la IA gana extremidades ilimitadas. Kuden no solo chatea, **Kuden opera**.
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
8.  **Agente Asesor IA Interno (Co-Piloto Corporativo):**
    Un módulo dedicado exclusivamente para los empleados de la empresa cliente (Ejecutivos de Ventas, Marketing). Al conocer toda la Base de Conocimiento (RAG) y los datos históricos de los clientes, este Agente Interno actuará como consultor estratégico: sugiriendo promociones, redactando copys para redes sociales, creando plantillas de WhatsApp de alta conversión, e incluso analizando tendencias de ventas. Kuden se convierte así en una herramienta de *crecimiento* (Growth), no solo de *soporte*.
9.  **Alertas Automáticas y Escalación Proactiva (Vía n8n):**
    Si la IA detecta a un cliente VIP con riesgo de fuga ALTO, el sistema no solo lo muestra en el dashboard, sino que envía una alerta push inmediata al supervisor vía Slack o WhatsApp, permitiendo salvar la cuenta en minutos.
10. **Panel de Insights Predictivos (Analítica Macro y Evaluación de Desempeño):**
    Una IA que funciona como el Analista de Datos Jefe del negocio. Lee miles de reportes mensuales de forma agregada para dar conclusiones estratégicas al gerente (Ej: *"El 40% de la fuga este mes provino de fallas en la pasarela de pagos"*). Además, evalúa el **desempeño humano**: genera rankings automáticos de los ejecutivos basados en CSAT, TMO y cierres; compara su evolución mes a mes frente a sus pares, e identifica a los mejores talentos para planes de incentivos o capacitación. Un verdadero *Business Intelligence* conversacional.
