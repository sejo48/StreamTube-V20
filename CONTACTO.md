# Correo de BOXPLAYTV

El contacto web y móvil está en `contacto.html`, enlazado desde la cabecera, el menú Más y la ayuda de acceso.

- Destinatario: `sejo48@gmail.com`.
- Asunto: `Correo de BOXPLAYTV · Nuevo mensaje`.
- Campos: nombre, correo completo para responder y mensaje. No solicita teléfono.
- Servicio de envío: FormSubmit, con el correo ya confirmado para `boxplaytv.com`. El campo `email` configura Reply-To.
- El envío principal usa datos de formulario URL-encoded, sin preflight JSON. Permite hasta 90 segundos para recibir la confirmación y avisa a los 15 segundos si el servicio tarda. No repite solicitudes ni cambia automáticamente de canal.
- La pantalla de éxito aparece únicamente con confirmación explícita del proveedor. Un error HTTP, respuesta no JSON, activación pendiente o pérdida de conexión mantiene los campos y advierte que el correo podría haber llegado, para evitar duplicados. Se comprobó que el proveedor puede devolver un error del servidor incluso cuando otros envíos llegan correctamente.
- La alternativa «Enviar desde mi correo» abre un borrador con destinatario, asunto y consulta. El visitante debe pulsar Enviar en su aplicación de correo. Abrir ese borrador no muestra una confirmación de entrega ni borra los campos. La dirección también queda visible para escribir manualmente.
- Honeypot y filtros del proveedor protegen el formulario. Si no hay JavaScript, queda disponible el POST HTML y el enlace de correo.
- Las notificaciones del móvil se configuran en Gmail/Android. El formulario no puede habilitar los permisos del teléfono.

Documentación del proveedor: https://formsubmit.co/documentation

Comprobación: `node --test tests/contact.test.cjs`.
