# queryBox — Feature Proposals

Propuestas de funcionalidades para las próximas iteraciones del proyecto.

---

## 1. Authentication System

**Prioridad**: Alta
**Complejidad**: Media-Alta

Agregar soporte nativo para métodos de autenticación en las requests HTTP.

### Alcance

- **Basic Auth**: Usuario y contraseña con codificación Base64 automática
- **Bearer Token**: Campo para token JWT o API key con inyección en header `Authorization`
- **API Key**: Configuración flexible para enviar la key como header o query param
- **OAuth 2.0** *(fase posterior)*: Flujo de autorización con refresh token

### Valor

Es una de las funcionalidades más solicitadas en cualquier HTTP client. Sin autenticación, probar APIs protegidas requiere construir manualmente los headers, lo cual es tedioso y propenso a errores.

### Integración

- Nueva pestaña **"Auth"** en `RequestConfigTabs` junto a Params, Headers y Body
- Los headers de autenticación se inyectan automáticamente al ejecutar la request
- Compatible con environment variables (`{{token}}`, `{{apiKey}}`)
- Persistencia por tab en localStorage

---

## 2. Code Snippet Generator

**Prioridad**: Media
**Complejidad**: Media

Generar fragmentos de código listos para copiar a partir de la request configurada.

### Alcance

- **cURL**: Comando completo con headers, body y método
- **JavaScript (fetch)**: Código ES6+ con async/await
- **Python (requests)**: Snippet usando la librería `requests`
- **Node.js (axios)**: Código para entornos Node
- Botón de copiar al portapapeles con feedback visual

### Valor

Permite a los desarrolladores pasar rápidamente de prototipar en queryBox a integrar la llamada en su código. Es una feature estándar en Postman e Insomnia que acelera significativamente el workflow.

### Integración

- Botón/icono **"</>  Code"** en el `RequestBar` o como pestaña adicional
- Modal o panel lateral con selector de lenguaje
- Genera el snippet en tiempo real según el estado actual de la request
- Respeta las variables de entorno (muestra el valor interpolado o el placeholder según preferencia)

---

## 3. Collections Import/Export

**Prioridad**: Alta
**Complejidad**: Media

Permitir exportar e importar colecciones para compartir entre equipos o respaldar configuraciones.

### Alcance

- **Export**: Descargar colecciones como archivo JSON con formato propio de queryBox
- **Import**: Cargar colecciones desde archivo JSON
- **Compatibilidad Postman** *(fase posterior)*: Importar archivos `.postman_collection.json` (v2.1)
- Export/Import de environments individuales o completos

### Valor

Actualmente todo vive en localStorage, lo cual es frágil (se pierde al limpiar datos del navegador). Esta feature habilita:
- Backup y restauración de datos
- Compartir colecciones entre miembros del equipo
- Migración desde Postman u otras herramientas

### Integración

- Botones de **Export/Import** en el header del `CollectionPanel` y `EnvironmentPanel`
- Diálogo de confirmación al importar (merge vs replace)
- Validación del schema JSON al importar
- Notificaciones de éxito/error

---

## 4. WebSocket Testing

**Prioridad**: Media
**Complejidad**: Alta

Agregar un cliente WebSocket integrado para probar conexiones en tiempo real.

### Alcance

- Conectar/desconectar a endpoints WebSocket (`ws://` y `wss://`)
- Enviar mensajes (texto plano y JSON con formato)
- Log de mensajes recibidos con timestamp y dirección (sent/received)
- Indicador visual del estado de la conexión (connected, disconnected, error)
- Soporte para custom headers en el handshake

### Valor

Muchas APIs modernas usan WebSockets para comunicación en tiempo real (chat, notificaciones, streaming). No existe un buen cliente WebSocket integrado en navegador, lo que haría de queryBox una herramienta más completa que la mayoría de alternativas web.

### Integración

- Nuevo tipo de tab: **"WebSocket"** además del tab HTTP existente
- Interfaz de chat-like para el log de mensajes
- Reutiliza el sistema de tabs, environment variables e history
- Panel de conexión con URL, protocolos y headers

---

## 5. Request Chaining (Workflows)

**Prioridad**: Media-Alta
**Complejidad**: Alta

Ejecutar secuencias de requests donde la respuesta de una alimenta la siguiente.

### Alcance

- **Extraer valores** de una respuesta usando JSONPath (ej: `$.data.token`)
- **Inyectar valores** extraídos como variables en requests siguientes
- **Workflow visual**: Ordenar requests en secuencia con drag & drop
- **Ejecución secuencial**: Botón "Run All" que ejecuta el workflow completo
- **Reporte de resultados**: Vista resumen con status de cada paso

### Valor

Es el paso natural después de tener environment variables. Los flujos reales de APIs requieren encadenar llamadas: login → obtener token → usar token en llamadas posteriores. Sin esta feature, el usuario debe copiar/pegar valores manualmente entre requests.

### Integración

- Nueva sección **"Workflows"** en el sidebar
- Cada workflow es una lista ordenada de requests de las colecciones
- Variables de extracción almacenadas como "chain variables" temporales
- Compatible con environment variables (las chain variables tienen prioridad)
- Persistencia en localStorage con el mismo patrón de los stores existentes

---

## Roadmap Sugerido

| Fase | Feature                    | Dependencias          |
|------|----------------------------|-----------------------|
| 1    | Authentication System      | Ninguna               |
| 2    | Collections Import/Export  | Ninguna               |
| 3    | Code Snippet Generator     | Ninguna               |
| 4    | WebSocket Testing          | Ninguna               |
| 5    | Request Chaining           | Collections, Auth     |

> Las fases 1-3 son independientes y podrían desarrollarse en paralelo.
> La fase 5 se beneficia de tener Auth y Collections maduros antes de implementarse.
