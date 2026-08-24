// pdf-parse no publica tipos y la ruta profunda evita el index.js del paquete,
// que al importarse ejecuta código de debug que lee un PDF de prueba del disco.
declare module 'pdf-parse/lib/pdf-parse.js';
