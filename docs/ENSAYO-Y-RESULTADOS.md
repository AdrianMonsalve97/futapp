# Ensayo libre y cierre de encuentros

En **Dirección deportiva → Ensayo libre** se utiliza todo el plantel activo. No
se exige confirmación de asistencia, inscripción al torneo ni arbitraje. Una
suspensión deportiva limita la convocatoria oficial, pero no el entrenamiento.
Puedes trabajar sin partido o usar uno como referencia de formato y duración.

Selecciona un sistema, toca una ficha para cambiar al jugador y elige variantes
con y sin balón. El portero requiere posición principal o secundaria de portero.
Cambiar una ficha mueve al jugador sin duplicarlo. Las modificaciones del ensayo
se conservan al pasar a Jugadas; recalcular o cambiar de contexto reconstruye la
propuesta. Son cambios de esta sesión, sin publicar ni guardar un inicial oficial.
En **Convocatoria oficial** se conservan los requisitos del partido y la prioridad
de los pagos aprobados. La excepción del 18 de octubre no se prolonga.

Las jugadas comparten el mismo campo en perspectiva y las fotos del equipo.
El balón señala la posesión; los trazos verdes indican apoyos y desmarques. El
ensayo adapta el desplazamiento al espacio disponible para evitar superposición
de fichas. Reproducción voluntaria, pasos, ritmo y repetición permiten estudiar
la secuencia; ocultar la pestaña pausa y las preferencias de movimiento reducido
eliminan las transiciones. Son esquemas, no datos de seguimiento de jugadores.

## Finalizar y actualizar la clasificación

1. En **Partidos → Resultados**, o en la sala del partido, pulsa **Finalizar partido**.
2. Confirma los goles del equipo y del rival. Se permite 0–0, pero no marcadores
   incompletos. Un marcador guardado mientras el estado siga programado todavía
   necesita confirmación.
3. El cierre utiliza la transacción existente: conserva el resultado y liquida el
   reparto de arbitraje. El torneo asociado calcula puntos, goles, diferencia y
   forma a partir de los partidos jugados en cada consulta. Corregir un resultado
   recalcula la tabla; confirmar dos veces no duplica puntos ni liquidaciones.

Un encuentro cuyo tiempo reglamentario y descanso confirmado ya transcurrieron
sale de próximas fechas y aparece **Pendiente de resultado**. El reloj no confirma
que se jugó ni inventa el marcador. Los aplazados siguen accesibles para su
reprogramación. Inicio, calendario, plantilla y API de jugador comparten esta
regla. Los calendarios visibles se actualizan cada minuto y la clasificación cada
30 segundos, además de al recuperar foco, conservando los borradores del editor.

No se cambian esquemas de base de datos ni formatos de respaldo. Las pruebas de
integración se ejecutan en SQLite y PostgreSQL aislados, incluido el PostgreSQL
real del flujo de GitHub Actions antes del despliegue de Render.
