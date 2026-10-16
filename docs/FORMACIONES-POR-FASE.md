# Sistemas por fase

En la sala del partido, **Estructura** conserva la formación base y permite asignar jugadores. **Con balón** y **Sin balón** permiten elegir sistemas distintos para el mismo equipo. En F8 todas las opciones incluyen ocho jugadores, incluido el portero. La normativa del torneo limita las opciones de las tres fases.

Cada cambio redistribuye las posiciones reales del catálogo, conserva las fotos, dorsales e identidad de los jugadores y mantiene al portero en su función. La asignación minimiza cambios de rol, lado y distancia; el entrenador debe revisar las adaptaciones. Las líneas de apoyo se calculan sobre las posiciones de la fase activa. Activarlas muestra conexiones y no cambia la elección del sistema.

Los sistemas se guardan junto con el borrador de la alineación en una transacción. Al publicar, se copian junto con la formación base y los jugadores. Las vistas del jugador, sus partidos, el inicio y el enfoque individual utilizan esa copia: una edición posterior del borrador no altera el plan publicado. El replay usa los mismos sistemas e identidades, incluso en pases de vuelta y transiciones.

Los partidos anteriores conservan sus datos. Si todavía no tienen sistemas por fase, se muestran variantes de referencia claramente identificadas; publicar el plan guarda las elecciones. No se modifica automáticamente ningún partido real durante el despliegue.

SQLite y PostgreSQL reciben dos columnas de texto opcionales. Los respaldos antiguos siguen siendo válidos y reciben valores nulos; los nuevos conservan y validan ambos sistemas y su publicación. Las pruebas cubren permisos, borradores privados, publicación, transacciones, restauración, migración repetible y geometría compacta en los cuatro formatos.
