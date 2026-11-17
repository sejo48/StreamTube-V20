# Correo de BOXPLAYTV

El contacto web y móvil está en `contacto.html`, enlazado desde la cabecera, el menú Más y la ayuda de acceso.

- Destinatario: `sejo48@gmail.com`.
- Asunto: `Correo de BOXPLAYTV · Nuevo mensaje`.
- Campos: nombre, correo para responder y mensaje. No solicita teléfono.
- Envío: FormSubmit, sin credenciales en el navegador. El campo `email` configura Reply-To para responder al visitante.
- Se requiere confirmar el correo con el enlace de activación que envía FormSubmit en el primer envío. Hasta entonces la interfaz no anuncia que el mensaje se haya enviado.
- El formulario envía mediante un POST HTML normal y el servicio devuelve al visitante a `contacto.html?enviado=1` al completar el envío. La confirmación no depende de una respuesta AJAX ni de un temporizador local: las primeras pruebas mostraron que el correo podía llegar aunque el navegador no recibiera esa respuesta.
- La protección del proveedor y el campo honeypot filtran los envíos. No se añade un desafío reCAPTCHA al flujo, como en el envío AJAX anterior. Nombre, correo completo y mensaje son obligatorios.
- El formulario sigue funcionando sin JavaScript, evita envíos simultáneos cuando está habilitado y no reintenta automáticamente. Al volver con Atrás desde un error de red o del proveedor se habilita nuevamente el botón sin borrar los campos.
- Las notificaciones del móvil se configuran en Gmail/Android. El formulario no puede habilitar los permisos del teléfono. El asunto identifica los avisos de BOXPLAYTV.

Documentación del proveedor: https://formsubmit.co/documentation

Comprobación: `node --test tests/contact.test.cjs`.
