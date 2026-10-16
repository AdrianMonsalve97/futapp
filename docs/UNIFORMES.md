# Uniformes y camisetas de familiares

En **Administrador → Uniformes → Catálogo → Agregar prenda**, elige la variante **Local**, **Visitante** o **Entrenamiento**. Puedes adjuntar la imagen de referencia.

- **Uniforme completo con medias** incluye camiseta, pantaloneta y medias. Configura el precio del conjunto y el stock en conjuntos completos.
- **Solo camiseta** tiene su propio precio y stock. Permite pedidos para el jugador, su pareja o sus hijos.

Para ofrecer las dos opciones, crea dos prendas distintas por variante. Las variantes antiguas titular y alterna se muestran como Local y Visitante sin cambiar los pedidos existentes.

En **Mis uniformes → Tienda**, el jugador encuentra una colección con fotos grandes, referencia ampliable, precio y disponibilidad reales. El catálogo utiliza dos columnas en móvil y tres en escritorio, con filtros Local/Visitante/Entrenamiento, tipo de prenda, búsqueda y orden por precio. **Hacer mi pedido** o **Elegir** abre la selección de destinatario, talla y observaciones, con vista previa y resumen del valor. Para una pareja o hijo/a el nombre es obligatorio. Cada familiar requiere su propia solicitud; los pedidos y pagos quedan en la cuenta del jugador. **Mis pedidos** permite ver el QR, subir el comprobante y consultar el historial. Las prendas sin stock siguen disponibles bajo pedido, sujetas a confirmación del administrador.

El administrador ve el jugador responsable, destinatario, nombre y detalle en **Solicitudes** y **Entregas**. También puede registrar una entrega directa con esos datos. El pago sigue usando el QR y el comprobante; el concepto incluye el nombre del familiar para distinguir sus pedidos.

**Administrador → Uniformes → Solicitudes** usa una tabla compacta de seis columnas cuando hay espacio y tarjetas cuando el panel es más estrecho, considerando también el espacio ocupado por la barra lateral. **Ver detalle** muestra correo, destinatario, observaciones, precio y revisión completos; desde allí se aprueba, rechaza o registra la entrega con una nota. La búsqueda admite nombres, dorsal y detalles sin distinguir acentos; también se filtra por estado y variante. La paginación permite 10, 25 o 50 registros. **Descargar Excel** exporta todos los registros filtrados, incluyendo los de otras páginas, a un `.xlsx` de 18 columnas con filtros y encabezados inmovilizados. Dorsal y posición corresponden al perfil actual; el precio es el que se guardó al solicitar. Los textos del jugador se escriben como texto, nunca como fórmulas.

`GET /api/uniform-requests/export?search=...&status=...&variant=...` está restringido al administrador y limitado a 10 descargas por minuto. El archivo contiene datos personales de pedidos y debe compartirse solo con quienes los gestionan. No exporta información de salud, contraseñas ni sesiones.

La presentación usa imágenes propias del catálogo y transiciones suaves de entrada y enfoque del producto, con reducción de movimiento según la preferencia del dispositivo. No incorpora fotografías de otras tiendas ni inventa descuentos o existencias.

## Eliminar una solicitud errada

El administrador puede usar el icono de papelera o **Ver detalle → Eliminar solicitud errada**, incluso si está aprobada o entregada. La confirmación explica qué se conserva. La solicitud desaparece de las listas del administrador y del jugador, de las búsquedas y del Excel. Se guarda una marca de eliminación con la cuenta administradora y la fecha para mantener los pagos vinculados y el historial.

- **Sin entrega:** deja de generar saldo pendiente. Los comprobantes sin revisar se rechazan y se conservan sus archivos y motivo. Los abonos aprobados permanecen en el historial; eliminar la solicitud no registra ni realiza una devolución de dinero.
- **Con entrega:** la entrega real, el stock y el cobro se conservan. Eliminar la solicitud no equivale a devolver la prenda. Las devoluciones físicas siguen registrándose desde **Entregas**.

Solo el administrador puede eliminar solicitudes; la operación y el rechazo de soportes pendientes se guardan juntos. No se elimina ningún pedido real para comprobar esta función durante un despliegue.

## Historial de pagos y comprobantes

**Administrador → Pagos y comprobantes** abre en **Historial completo**. Muestra abonos de inscripción de todas las temporadas, tanto manuales como QR, y todos los comprobantes de uniformes y arbitraje: pendientes, confirmados y rechazados. Los pagos QR de inscripción se vinculan con su abono para mostrarlos una sola vez. **Por revisar** mantiene una bandeja separada para aprobar o rechazar.

Se puede filtrar por jugador o referencia, concepto, tipo, estado y fechas de pago en Colombia. Los detalles incluyen observaciones, medio, revisión, foto original y descarga. Los PDF se abren en otra pestaña sin habilitar contenido incrustado ni desactivar la política de seguridad. Los registros manuales sin adjunto lo indican. Si una inscripción antigua contiene saldo pagado sin movimientos detallados, aparece como **Saldo anterior**, sin inventar fecha ni comprobante; no duplica los movimientos existentes.

El jugador ve el mismo historial limitado a su propia cuenta en **Mis pedidos** y su apartado de inscripción. Las solicitudes eliminadas mantienen una indicación en el historial. Los respaldos conservan las marcas de eliminación; los paquetes anteriores sin esa tabla siguen aceptándose.

La solicitud conserva el precio al momento de pedirla. El stock se descuenta al entregar, una unidad por camiseta o conjunto, y se repone una sola vez al marcar una devolución. No se puede convertir una camiseta con pedidos familiares en un uniforme completo: crea otra prenda.

Los respaldos e ingestas incluyen los destinatarios. Los respaldos anteriores se aceptan y sus pedidos permanecen asociados al jugador.
