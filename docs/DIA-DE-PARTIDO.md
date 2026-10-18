# Plantilla del día y excepción de arbitraje

La sala táctica del administrador muestra la plantilla de quienes confirmaron asistencia el día del partido. Distingue a los asignados en cancha del banco y conserva los impedimentos deportivos, de inscripción o de cuenta. Se actualiza cada treinta segundos mientras la pestaña está visible y al regresar a ella. El entrenador conserva la decisión sobre el inicial y su publicación.

El punto rojo en cada ficha administrativa significa que la cuota todavía no está cubierta por pagos **aprobados**. Un comprobante en revisión conserva el punto; la aprobación de la cuota completa lo retira. El indicador acompaña la identidad del jugador en las distintas fases. Los jugadores consultan sus propios pagos; la API pública del equipo no comparte los indicadores financieros de sus compañeros.

La autorización administrativa `POST /api/matches/:id/referee/allow-confirmed-today`, con `{ "date": "AAAA-MM-DD" }`, habilita excepcionalmente a los confirmados sin exigir pago previo para el inicial. Solo acepta la fecha actual de Colombia y un partido programado para ese mismo día. Es idempotente y se conserva con su fecha en el partido. No modifica importes, comprobantes, aprobaciones ni saldos. Las suspensiones, bajas e inscripción al torneo siguen siendo obligatorias.

Entre los asistentes habilitados, la propuesta prioriza la cuota completa cubierta por pagos o saldos aprobados. Los comprobantes pendientes y los abonos incompletos no reciben prioridad. La selección completa las posiciones legales, maximiza la presencia de jugadores con prioridad y después optimiza el rendimiento y encaje deportivo. El portero sigue siendo obligatorio; esta preferencia no altera sus calificaciones ni el pronóstico del modelo. La plantilla del día, el selector manual y el banco propuesto muestran primero a quienes tienen el arbitraje cubierto.

La excepción vence exactamente al empezar el siguiente día en Colombia (UTC-5). No se hereda a otros partidos ni se traslada al reprogramar. El servidor aplica de nuevo las 24 horas para pago y aprobación, sin depender de un cron ni de que el navegador permanezca abierto. El partido jugado conserva su historia deportiva y financiera.

La migración añade una columna nullable a `match_referee_fees` en SQLite y PostgreSQL. Los respaldos anteriores reciben un valor nulo; los nuevos validan y conservan la fecha y todos los pagos. Las pruebas con reloj controlado cubren medianoche, aislamiento por partido, permisos, comprobantes pendientes y aprobados, persistencia, restauración y privacidad.
