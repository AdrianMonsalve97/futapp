# Uniformes y camisetas de familiares

En **Administrador → Uniformes → Catálogo → Agregar prenda**, elige la variante **Local**, **Visitante** o **Entrenamiento**. Puedes adjuntar la imagen de referencia.

- **Uniforme completo con medias** incluye camiseta, pantaloneta y medias. Configura el precio del conjunto y el stock en conjuntos completos.
- **Solo camiseta** tiene su propio precio y stock. Permite pedidos para el jugador, su pareja o sus hijos.

Para ofrecer las dos opciones, crea dos prendas distintas por variante. Las variantes antiguas titular y alterna se muestran como Local y Visitante sin cambiar los pedidos existentes.

En **Mis uniformes → Tienda**, el jugador entra a un vestuario interactivo con estética de videojuego. Recorre las prendas con flechas, selecciona miniaturas, gira la presentación de la foto y amplía la referencia. La ficha lateral muestra la identidad del jugador, contenido, stock y precio reales. Puede filtrar Local/Visitante/Entrenamiento y el tipo de prenda, buscar y ordenar por precio. **Equiparme** abre la selección de destinatario, talla y observaciones, con vista previa y resumen del valor. Para una pareja o hijo/a el nombre es obligatorio. Cada familiar requiere su propia solicitud; los pedidos y pagos quedan en la cuenta del jugador. **Mis pedidos** permite ver el QR y subir el comprobante. Las prendas sin stock siguen disponibles bajo pedido, sujetas a confirmación del administrador.

El administrador ve el jugador responsable, destinatario, nombre y detalle en **Solicitudes** y **Entregas**. También puede registrar una entrega directa con esos datos. El pago sigue usando el QR y el comprobante; el concepto incluye el nombre del familiar para distinguir sus pedidos.

**Administrador → Uniformes → Solicitudes** muestra una tabla con fecha, jugador, correo, dorsal, prenda y variante, destinatario, talla, precio del pedido, observaciones, estado y revisión. La búsqueda admite nombres, dorsal y detalles sin distinguir acentos; también se filtra por estado y variante. La paginación permite 10, 25 o 50 registros. **Descargar Excel** exporta todos los registros filtrados, incluyendo los de otras páginas, a un `.xlsx` con filtros de columna y encabezados inmovilizados. El archivo incluye posición y fecha de revisión, valores numéricos y fechas UTC. Dorsal y posición corresponden al perfil actual; el precio es el que se guardó al solicitar. Los textos del jugador se escriben como texto, nunca como fórmulas.

`GET /api/uniform-requests/export?search=...&status=...&variant=...` está restringido al administrador y limitado a 10 descargas por minuto. El archivo contiene datos personales de pedidos y debe compartirse solo con quienes los gestionan. No exporta información de salud, contraseñas ni sesiones.

La presentación usa imágenes propias del catálogo y animaciones de entrada, flotación y enfoque de producto, con reducción de movimiento según la preferencia del dispositivo. Referencias de navegación y personalización: [Nike Football Kits](https://www.nike.com/gb/w/football-kits-jerseys-1gdj0z3a41e/) y [adidas Soccer Jerseys](https://www.adidas.com/us/shop-soccer-jerseys). No se incorporan sus imágenes ni diseños de marca.

La solicitud conserva el precio al momento de pedirla. El stock se descuenta al entregar, una unidad por camiseta o conjunto, y se repone una sola vez al marcar una devolución. No se puede convertir una camiseta con pedidos familiares en un uniforme completo: crea otra prenda.

Los respaldos e ingestas incluyen los destinatarios. Los respaldos anteriores se aceptan y sus pedidos permanecen asociados al jugador.
