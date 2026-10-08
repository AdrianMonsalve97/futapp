# Sesiones e inactividad

Los jugadores salen automáticamente después de **15 minutos sin interacción**. El login muestra que la sesión se cerró por inactividad y permite ingresar de nuevo con su contraseña habitual. Esto no da de baja al jugador ni elimina sus datos.

Mover el cursor, tocar, desplazarse o escribir dentro de la app cuenta como actividad. La actividad se comparte entre pestañas de la misma sesión. Las consultas automáticas, una pestaña oculta, recargar o simplemente volver a enfocar la ventana no renuevan el plazo.

Al suspender el computador o el teléfono, se comprueba el plazo al regresar. Si hay otra pestaña activa, se toma su actividad reciente. El cliente se bloquea aunque no tenga conexión; el servidor comprueba y revoca las sesiones vencidas antes de permitir acceder a datos o guardar cambios. Un aviso de actividad posterior al vencimiento no puede reabrir esa sesión.

El servidor recibe un aviso de actividad como máximo una vez por minuto, únicamente si hubo interacción. La renovación no cambia la caducidad general del JWT. Los avisos no incluyen contraseñas, tokens ni timestamps elegidos por el navegador.

Los administradores están **exentos del cierre por inactividad**. Se mantienen la caducidad general de la sesión y las revocaciones por cierre manual, cambio de contraseña, rol o estado de la cuenta.

Para cambiar el plazo de los jugadores, configura `PLAYER_IDLE_MINUTES` en el servidor con un entero de 1 a 240. El valor predeterminado es 15 y la API comunica la política al navegador. No es una variable `VITE_*` ni una preferencia del jugador.

La migración añade el registro de última actividad sin reiniciar los plazos en cada despliegue. Las sesiones que ya existían al introducir esta función empiezan su primer plazo desde esa migración. Los respaldos anteriores continúan siendo compatibles y no restauran sesiones de acceso.
