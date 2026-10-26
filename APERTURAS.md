# Aperturas de suscriptores

`app-openings.js` registra un documento en `aperturas/{idAleatorio}` después de autorizar al suscriptor en la aplicación principal o en Smart TV. El documento contiene `email`, `deviceId`, `day` (YYYY-MM-DD en America/Costa_Rica) y `openedAt` (ISO UTC).

Una apertura es una carga o recarga del documento de la aplicación. Volver de otra pestaña, minimizar y restaurar sin recargar, verificar nuevamente la cuenta y los latidos de presencia no crean eventos adicionales. Cada nueva carga crea un identificador nuevo. Dentro de la misma carga se cuenta una vez por correo autorizado. Los intentos sin autorización no cuentan. El registro se reintenta con el mismo identificador si falla, sin impedir la reproducción. Si se cierra la aplicación antes de guardar el evento, puede perderse esa apertura; no se promete contabilizar uso sin conexión.

El panel complementario `sejo48/panel-usuarios` consulta el mes actual por el campo `day` y muestra hoy, total mensual y detalle diario por usuario. Los eventos anteriores se conservan; el cambio de mes no borra datos. No se recuperan aperturas previas a esta implementación.

## Activación

1. Revisar e integrar los cambios de ambos repositorios y publicar sus archivos nuevos junto a los HTML modificados.
2. Verificar las reglas de Firestore para `aperturas`. La aplicación necesita guardar su evento y reintentar la misma escritura; el administrador necesita consultar el mes por `day`. Mantener acceso restringido y validar identidad, dispositivo y campos en las reglas o en un backend. No habilitar lectura/escritura pública para resolver un error de permisos. Este repositorio no incluye las reglas desplegadas ni credenciales administrativas para cambiarlas.
3. Verificar con una cuenta de prueba autorizada: abrir dos veces, comprobar Hoy: 2 y Mes: 2; dejar abierta más de 30 segundos y comprobar que no suma. Repetir en Smart TV.

La fecha utiliza el reloj del dispositivo convertido a Costa Rica. Este contador operativo no sustituye registros de auditoría confiables en un backend; clientes modificados o relojes incorrectos pueden alterar eventos.

## Verificación local

`node --test tests/app-openings.test.cjs`
