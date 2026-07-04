# Kuden QA: Sistema Inteligente de Auditoría y Calidad (Contact Centers)
*Documento Base de Arquitectura, Contexto y Roadmap*

Este documento define la visión, el modelo de negocio y la arquitectura técnica de **Kuden QA**, una plataforma paralela al ecosistema Kuden IA, enfocada en revolucionar el aseguramiento de calidad (Quality Assurance) en Contact Centers y BPOs.

---

## 0. Identidad Kuden y Filosofía de IA (Contexto para la IA Asesora)

Kuden es una compañía especializada en **Inteligencia Artificial Operativa**. No somos una empresa de software genérico; operamos bajo un modelo **"Done-For-You"** de alto nivel. Construimos sistemas premium, escalables y autónomos que resuelven problemas financieros y operativos reales para corporativos y PyMEs.

Nuestra filosofía central es: *"Tu equipo no debería trabajar para el software. El software debería trabajar para ellos."*

**Qué esperamos de ti (La IA Asesora / Antigravity):**
*   **Rol Asignado:** Eres el Asesor Estratégico, Técnico y Comercial de Kuden.
*   **Tono y Enfoque:** Ultra profesional, directo al grano y enfocado en resultados. No des respuestas teóricas genéricas, construye soluciones listas para producción.
*   **Proactividad:** Si te proponemos una idea arquitectónica que no escala, que es frágil o que no se alinea con un estándar *Enterprise*, debes cuestionarla inmediatamente y proponer una alternativa robusta.
*   **Estándar Visual:** Todo lo que construyamos debe tener un nivel visual *Premium* (efectos *Glassmorphism*, interfaces limpias, tipografía cuidada). Si se ve básico o descuidado, hemos fallado.

---

## 1. Visión del Producto y Problema a Resolver

**El Problema:** Actualmente, los departamentos de Calidad en los Contact Centers operan de forma manual. Un equipo de humanos escucha grabaciones de llamadas aleatorias para evaluarlas mediante pautas (rubrics). Este proceso es lento, costoso y estadísticamente irrelevante, logrando auditar apenas entre el **1% y el 3%** de la operación total.

**La Solución (Kuden QA):** Un sistema automatizado que ingesta el 100% de las llamadas de un repositorio, las transcribe a texto a muy bajo costo y utiliza Inteligencia Artificial (LLMs) para aplicar pautas de evaluación complejas.
Kuden QA no solo califica a los ejecutivos, sino que extrae **Insights Macro** (ej. "El 40% de las ventas caen porque el precio parece alto" o "El equipo necesita capacitación en el producto X").

---

## 2. Arquitectura Base y Ecosistema Técnico

El proyecto utilizará una arquitectura moderna, modular y **Stateless** (Sin estado en memoria), garantizando escalabilidad horizontal.

*   **Frontend (SPA):** React 18 + Vite.
    *   **Estilos:** CSS Vanilla (`index.css`) basado en variables globales para soportar Modo Claro/Oscuro nativo.
    *   **Diseño Visual:** Estética premium, minimalista y orgánica. Evitar esquinas duras (radios de 16px a 24px) y uso intensivo de *Glassmorphism* (fondos translúcidos `rgba` con `backdrop-filter: blur(24px)`).
*   **Backend (API RESTful):** Node.js + Express.js. Actuará como el "Hub Central" orquestando las transcripciones y consultas LLM.
*   **Base de Datos y Auth:** Supabase (PostgreSQL + Auth + pgvector).
    *   **Seguridad:** Aislamiento estricto de datos usando Row Level Security (RLS) nativo de Postgres, filtrando por el `tenant_id` presente en el JWT, garantizando un *Multi-tenancy* puro.

### 2.1. Topología de Ingesta (El Origen de los Audios)
Se descarta el uso de un SIP Trunk de telefonía cruda para evitar la complejidad y latencia de red. Kuden QA operará mediante dos vías principales:
*   **Vía 1: Ingesta Pasiva (Asíncrona y Batch):** El administrador (Tenant) configurará credenciales de repositorios de grabaciones (SFTP, FTP, AWS S3). Un **Worker interno en Node.js** (Cronjob) ejecutará descargas programadas (nocturnas/horarias) garantizando monitoreo automático.
*   **Vía 2: Push API (Semi Tiempo Real):** Kuden QA expondrá un Endpoint API protegido (`POST /api/qa/ingest`). Cuando un cliente finalice una llamada y asigne la tipificación en su propio sistema, podrá disparar un Webhook hacia Kuden QA inyectando los metadatos (RUT, Nombre, Estado) y el **archivo de audio codificado en Base64**. Esto permite una auditoría casi inmediata (segundos después de cortar la llamada), dándole al sistema una percepción de "Tiempo Real" sin lidiar con los riesgos de un protocolo SIP.

### 2.2. Pipeline de Procesamiento (Speech-to-Text y Análisis)
Para mantener la rentabilidad del modelo de negocio, se utilizará un enfoque híbrido:
1.  **Transcripción (STT) Auto-Alojada:** Para transcribir masivamente horas de audio a costo $0 por minuto, se utilizarán motores locales / Open Source (ej. Whisper.cpp montado en un servidor propio con GPU o instancias optimizadas).
2.  **Análisis de la Pauta (LLM):** Las transcripciones de texto se enviarán a un LLM (puede ser local vía Ollama o en la nube para razonamiento complejo) inyectando la Pauta de Calidad en el Prompt del Sistema.
3.  **Generación de Insights:** Para los reportes gerenciales de alto nivel, se utilizarán modelos LLM avanzados en la nube (ej. Claude/OpenAI) que procesen la metadata agregada.

### 2.3. Almacenamiento (Estrategia Zero-Fat)
*   **Audios:** Kuden QA **NO** almacenará los archivos de audio binarios a largo plazo en sus propios servidores. En el caso de recibir audios por la Push API (Base64), el sistema decodificará el archivo en un *buffer* temporal (RAM o `/tmp`), procesará la transcripción y eliminará el binario inmediatamente (*ephemeral processing*).
*   **Metadatos:** Solo se almacenará la **Transcripción de texto** en PostgreSQL, junto con un enlace/ruta (URL o Path SFTP) al audio original si éste reside en los servidores del cliente. Esto reduce los costos de Storage de Kuden en un 99%.

---

## 3. El Corazón del Sistema: Motor de Pautas de Calidad

La plataforma permitirá a los supervisores crear **Pautas Dinámicas** configurables por Campaña.

### 3.1. Estructura de la Pauta (Rubric)
*   **Tipos de Respuesta (4 Estados):** Cada ítem evaluado por la IA tendrá 4 posibles salidas: `Sí`, `No`, `Parcialmente`, `No Aplica`.
*   **Sistema de Puntuación (Scoring):** Cada pregunta tendrá un peso (ej. 10 puntos). Al finalizar, la evaluación suma el puntaje total sobre el máximo posible (excluyendo los "No Aplica") para entregar un porcentaje de cumplimiento (Ej: 85%).
*   **Umbrales de Aprobación:** Configurables por campaña (Ej: "La llamada se considera APROBADA si el puntaje es >= 80%").
*   **Fatal Errors (Errores Críticos):** Existirán preguntas marcadas como "Cierre de Auditoría" (Auto-fail). Ej: *¿El ejecutivo usó lenguaje ofensivo?* Si la IA marca "Sí", la nota cae inmediatamente a 0% o se marca como "Reprobada" sin importar el resto del puntaje.

---

## 4. Resolución de Disputas y Aprendizaje Continuo (Human-in-the-Loop)

Kuden QA no pretende ser una caja negra inamovible, sino un sistema colaborativo con los supervisores humanos.

*   **Flujo de Disputa:** Si un ejecutivo o supervisor lee una auditoría y nota que la IA se equivocó (ej. la IA dijo que no se leyó el contrato, pero sí se leyó implícitamente), podrá presionar un botón de **"Disputar Evaluación"**.
*   **Revisión Humana:** El supervisor reproduce el audio (vía link externo), corrige la pregunta y aprueba el nuevo puntaje.
*   **Entrenamiento RAG Automático:** Al resolverse una disputa, el sistema toma la corrección y la vectoriza (usando `pgvector`). En futuras llamadas de esa campaña, si se presenta una ambigüedad similar, el LLM tendrá este nuevo conocimiento inyectado en su contexto para no volver a cometer el mismo error.

---

## 5. Fases de Desarrollo Sugeridas (Roadmap)

### Fase 1: MVP (Minimum Viable Product)
*   Setup del proyecto base (Vite + Node + Supabase).
*   **Módulo Multi-Tenant:** Creación del esquema relacional central en PostgreSQL:
    *   Tabla `tenants` (id, name, configuraciones_globales).
    *   Tabla `tenant_users` (id, tenant_id, user_id_auth, role).
    *   Activación de políticas RLS obligatorias para aislar la data por `tenant_id`.
*   Constructor de Pautas Dinámicas (CRUD de parámetros, pesos y Fatal Errors).
*   **Push API (Semi Real-Time):** Desarrollo del Endpoint REST para recibir cargas útiles con metadatos y audio en formato **Base64**, procesando el pipeline de transcripción de forma reactiva.
*   **Speaker Diarization (Obligatorio MVP):** Asegurar que el pipeline STT asigne correctamente [Speaker 1] y [Speaker 2] para que el LLM no alucine atribuyendo frases del cliente al ejecutivo.

### Fase 2: Automatización y Storage
*   Módulo de Conexiones (Integrations Hub para FTP/SFTP).
*   Worker de Cronjobs para descarga y encolamiento asíncrono.
*   Visualización de Transcripciones y Resultados con el UI Premium.

### Fase 3: Inteligencia y BI (Business Intelligence)
*   Implementación de Disputas y el flujo RAG de re-entrenamiento.
*   Dashboard Directivo ("Kimi Insights QA") para ver estadísticas agrupadas: Motivos frecuentes de falla, ejecutivos con peor nota, etc.

---

## 6. Consideraciones Críticas y Feature Backlog (Nivel Enterprise)

Para garantizar que Kuden QA escale y sea adoptado por operaciones de alto ticket, se deben considerar los siguientes desafíos arquitectónicos a medida que el proyecto avanza:

1.  **Diarización Estricta (Separación de Hablantes):** Vital desde la Fase 1. El motor STT debe soportar canales estéreo o diarización acústica. Si no sabemos quién dijo qué, la pauta pierde validez.
2.  **Análisis de Acústica y Silencios:** El LLM no puede leer pausas en el texto plano. El pipeline de ingesta debe medir el "Dead Air" (silencios largos) e interrupciones solapadas, inyectando esta metadata al LLM.
3.  **Scrubber de PII y PCI Compliance:** Las llamadas contienen tarjetas de crédito y datos médicos. Es imperativo integrar un motor de redacción/censura (ej. `[DATO OCULTO]`) en el pipeline de texto *antes* de enviarlo a modelos en la nube para cumplir con normativas de privacidad.
4.  **Sentimiento Acústico (Tono de Voz):** Un ejecutivo puede leer un guion perfecto con un tono agresivo. En Fases avanzadas, se debe implementar *Speech Emotion Recognition* para evaluar la empatía real de la voz, no solo la literalidad de las palabras.
5.  **Modo "Calibración" (Sandbox de Pautas):** Antes de aplicar una nueva pauta a la operación en vivo, el supervisor debe poder correrla contra un dataset de audios pasados (Backtesting) para validar que los resultados hacen sentido y la IA no está siendo demasiado estricta por culpa de un prompt mal redactado.
