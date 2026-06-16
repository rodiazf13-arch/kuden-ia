

async function main() {
  try {
    const res = await fetch('http://localhost:3001/api/widget/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'acfe12ae-9aa9-4c93-9662-848060ffbba6',
        conversationId: null,
        content: 'Hola desde el test'
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
