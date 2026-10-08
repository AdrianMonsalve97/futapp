# Pago del arbitraje por partido

Al programar un partido con fecha y hora se crea su cobro de arbitraje por **$120.000 COP**. Los jugadores activos e inscritos en el torneo, si lo hay, generan su cuota cuando confirman asistencia. La cuota se divide entre todos los asistentes confirmados, incluso si su pago sigue pendiente. Los pesos del redondeo se distribuyen por identificador de jugador para que las cuotas sumen exactamente el total.

En **Mis partidos → detalle del partido**, cada jugador ve su cuota y el vencimiento, paga con el QR del equipo y adjunta el comprobante, la referencia y la fecha y hora de la transferencia en Colombia. Los comprobantes son privados. En **Administrador → Pagos por QR y soportes**, el administrador verifica el monto y la fecha y hora contra el comprobante antes de aprobarlo o rechazarlo.

La fecha límite para ser titular es **48 horas antes del inicio**, en hora de Colombia:

- Pago completo y aprobado, realizado hasta el vencimiento inclusive: elegible para titular o suplente.
- Pago completo y aprobado, realizado después del vencimiento: elegible únicamente como suplente.
- Sin pago, abono insuficiente o comprobante pendiente de revisión: no elegible para la alineación ni para el banco recomendado por la IA.

La fecha de aprobación no cambia la fecha real de la transferencia. Si un abono se realizó a tiempo y otro después del plazo, solo los abonos realizados a tiempo cuentan para habilitar al titular. Las suspensiones, bajas y restricciones del torneo se mantienen.

La selección manual, publicación, IA táctica, banco de suplentes y preparación individual usan estas reglas. Para fútbol 8 se conservan las ocho posiciones del inicial; la IA deja vacantes si faltan jugadores habilitados. Un cambio que invalida a un titular limpia esa posición y retira la publicación, para que el administrador prepare nuevamente el equipo.

La cuota se recalcula con cambios en la asistencia mientras el partido esté pendiente. Los comprobantes no se borran: si aumenta la cuota aparece el saldo pendiente; si disminuye aparece saldo a favor. **Si un jugador ya pagó y marca que no asiste, su pago aprobado queda acumulado para sus siguientes fechas confirmadas**, ordenadas por fecha de inicio posterior al partido de origen. Los excedentes de cuota y los pagos de partidos cancelados también se acumulan. El sistema aplica únicamente lo necesario para cubrir cada cuota: si falta dinero, solicita la diferencia; si sobra, guarda el remanente. Sin asistencia confirmada no se consume ese saldo. El mismo peso no se aplica dos veces ni se transfiere a otro jugador.

Los saldos aplicados conservan el comprobante y la fecha original de la transferencia, que se compara con el vencimiento del nuevo partido para determinar titularidad o suplencia. No hace falta subir otro soporte para reutilizar un abono ya aprobado. Los soportes pendientes o rechazados no generan saldo acumulado. Mientras el partido está pendiente, retirar la asistencia libera su saldo aplicado para la siguiente fecha; volver a confirmar el partido original puede recuperar solo el saldo que aún no se haya utilizado en un partido jugado. El panel muestra el saldo aplicado, el trasladado a otras fechas y el acumulado disponible.

Al marcar el partido como jugado se guardan sus cuotas históricas y las aplicaciones de saldo consumidas, aunque un jugador sea desactivado después. Cancelar un partido conserva los soportes y devuelve los pagos a la cuenta de arbitraje. Un partido con comprobantes o aplicaciones históricas no se puede eliminar. Los respaldos incluyen el historial de aplicaciones y admiten paquetes anteriores, cuya tabla nueva se inicializa vacía.

Cambiar la fecha recalcula el vencimiento. La actualización mantiene las cuentas, contraseñas, archivos y pagos existentes. Las instalaciones anteriores admiten sus respaldos originales sin requerir una nueva ingesta.

La automatización CI/CD verifica tipos, pruebas del cobro y sus permisos, actualización de SQLite y PostgreSQL, compilación, arranque de producción y persistencia en Docker para AMD64/ARM64 antes de publicar el commit validado y comprobar la salud en Render.
