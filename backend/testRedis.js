import dotenv from "dotenv";
import { initRedis, getCachedHistory, setCachedHistory } from "./redisClient.js";

dotenv.config();

async function runTest() {
  console.log("Iniciando prueba de Redis...");
  
  const client = await initRedis();
  
  if (!client) {
    console.error("❌ Falla al inicializar Redis. Revisa las credenciales o la conexión de red.");
    process.exit(1);
  }
  
  console.log("✅ Conectado a Redis exitosamente.");
  
  const testConvId = "test-conv-12345";
  const testHistory = [
    { role: "user", content: "Hola, probando Redis" },
    { role: "assistant", content: "¡Redis funciona correctamente!" }
  ];
  
  console.log(`Guardando historial de prueba para convId: ${testConvId}...`);
  await setCachedHistory(testConvId, testHistory, 60); // expira en 60 seg
  console.log("✅ Historial guardado.");
  
  console.log("Recuperando historial...");
  const retrieved = await getCachedHistory(testConvId);
  
  if (retrieved && retrieved.length === 2 && retrieved[1].content.includes("Redis funciona")) {
    console.log("✅ Prueba completada con éxito. El caché de conversaciones está funcionando.");
    console.log("Datos recuperados:", retrieved);
  } else {
    console.error("❌ Falló la validación de los datos recuperados.", retrieved);
  }
  
  process.exit(0);
}

runTest();
