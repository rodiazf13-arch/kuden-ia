

async function main() {
  try {
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hola' }],
        contactData: { tenantId: 'acfe12ae-9aa9-4c93-9662-848060ffbba6', clienteNombre: 'Test User' }
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
main();
