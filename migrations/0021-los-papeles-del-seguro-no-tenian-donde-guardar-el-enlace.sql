-- Los papeles del seguro y las facturas del taller no tenían dónde guardar el
-- enlace, así que se guardaban vacíos.
--
-- Los papeles del coche -permiso, ficha técnica, ITV- viajan al cajón privado
-- del almacén y la fila guarda su dirección en `file_url`. Es lo que lee
-- `comoSeAbre` para dar el enlace firmado con el que la app los abre.
--
-- Estas dos tablas nacieron antes de eso y nunca se actualizaron: solo tienen
-- `file_content_base64`. Mientras el navegador mandaba el fichero dentro del
-- JSON funcionaba; desde que la app lo sube al almacén y manda la dirección,
-- lo que llega aquí es una fila con nombre, tamaño y NADA MÁS. Un papel que no
-- se puede abrir y que además no se sabe que no se puede abrir.
--
-- ── Cómo se vio ────────────────────────────────────────────────────────────
--
-- 1-oct-2026, Opel Corsa 5228HNS. En el almacén estaban los tres intentos de
-- subir la póliza -el mismo PDF a las 10:19, las 10:21 y las 10:37- y las ocho
-- facturas del taller. En la base: cero documentos de seguro y ocho facturas
-- con `file_size` de medio mega y cero bytes de contenido. El cliente subió su
-- póliza tres veces porque la pantalla seguía diciendo que no estaba.
--
-- Con `file_url` las filas vuelven a apuntar a algo, y el borrado se puede
-- hacer como en los papeles del coche: comparando direcciones en vez de
-- vaciar la tabla y volver a escribirla en cada guardado -que es la otra
-- mitad de la avería, y por lo que una póliza guardada desaparecía al guardar
-- cualquier otra cosa del coche-.
--
-- Los ficheros que ya están subidos no se pierden: siguen en el cajón privado
-- y se pueden volver a enlazar sabiendo su camino.

ALTER TABLE IF EXISTS moveadvisor_user_insurance_documents
  ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS moveadvisor_user_maintenance_invoices
  ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN moveadvisor_user_insurance_documents.file_url IS
  'Donde vive el fichero. Camino del cajon privado (erp-documentos) o URL publica, igual que moveadvisor_user_vehicle_documents.file_url. Vacio solo en las filas viejas que llevan el contenido en base64.';

COMMENT ON COLUMN moveadvisor_user_maintenance_invoices.file_url IS
  'Donde vive el fichero. Camino del cajon privado (erp-documentos) o URL publica, igual que moveadvisor_user_vehicle_documents.file_url. Vacio solo en las filas viejas que llevan el contenido en base64.';
