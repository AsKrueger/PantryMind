-- Se ejecuta una sola vez, cuando el contenedor arranca con el volumen vacío.
--
-- La base de datos de desarrollo la crea la propia imagen a partir de
-- POSTGRES_DB. Aquí se añade la de los tests de integración, separada para
-- que los tests puedan vaciar tablas sin tocar los datos de desarrollo.
--
-- El nombre es fijo porque un script SQL no lee variables de entorno; debe
-- coincidir con el de DATABASE_URL_TEST en ".env".
CREATE DATABASE pantrymind_test;
