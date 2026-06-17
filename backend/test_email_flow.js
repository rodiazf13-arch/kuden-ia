

const TENANT_ID = 'acfe12ae-9aa9-4c93-9662-848060ffbba6';
const SERVER_URL = 'http://localhost:3001';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== Iniciando Pruebas de Flujo Email n8n ===");

  const messageId = `<test-${Date.now()}@mail.example.com>`;
  let conversationId = null;

  try {
    console.log("\n1. Simulando Inbound Email (n8n -> Kuden)...");
    const inboundRes = await fetch(`${SERVER_URL}/api/webhook/n8n-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_ID,
        senderEmail: 'tester@n8n.io',
        senderName: 'Test N8N',
        subject: 'Ayuda con mi factura',
        textBody: 'Hola, tengo una duda con la factura de este mes. Saludos.',
        messageId: messageId
      })
    });
    
    const inboundData = await inboundRes.json();
    console.log("Inbound Status:", inboundRes.status);
    console.log("Inbound Data:", inboundData);

    if (inboundData.success && inboundData.conversationId) {
      conversationId = inboundData.conversationId;
      console.log(`✅ Inbound exitoso. Conversación ID: ${conversationId}`);
    } else {
      console.error("❌ Falló el Inbound.");
      return;
    }

    // Esperar un segundo
    await delay(1000);

    console.log("\n2. Simulando Outbound Email (Ejecutivo -> Kuden -> n8n)...");
    // Nota: Para que el webhook outbound funcione, el tenant en la base de datos debería tener un 'n8n_outbound_email_webhook' configurado.
    // Aunque no esté configurado en BD local, Kuden actualizará la conversación y tratará de hacer el fetch (que será ignorado si es nulo).
    const outboundRes = await fetch(`${SERVER_URL}/api/crm/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_ID,
        userId: null,
        displayName: 'Ejecutivo de Prueba',
        content: 'Hola Test N8N, claro que sí, te ayudaremos con tu factura.'
      })
    });

    const outboundData = await outboundRes.json();
    console.log("Outbound Status:", outboundRes.status);
    console.log("Outbound Data:", outboundData);
    
    if (outboundData.id) {
      console.log(`✅ Outbound (mensaje guardado y webhook disparado si estaba configurado).`);
    } else {
      console.error("❌ Falló el Outbound.");
    }

    console.log("\n=== Pruebas Completadas ===");
  } catch (e) {
    console.error("Error durante pruebas:", e);
  }
}

runTests();
