# Correo de BOXPLAYTV

El contacto web y móvil está en `contacto.html`, enlazado desde la cabecera, el menú Más y la ayuda de acceso.

- Destinatario: `sejo48@gmail.com`.
- Asunto: `Correo de BOXPLAYTV · Nuevo mensaje`.
- Campos: nombre, correo para responder y mensaje. No solicita teléfono.
- Envío: FormSubmit, sin credenciales en el navegador. El campo `email` configura Reply-To para responder al visitante.
- Se requiere confirmar el correo con el enlace de activación que envía FormSubmit en el primer envío. Hasta entonces la interfaz no anuncia que el mensaje se haya enviado.
- El envío por AJAX permanece en BOXPLAYTV. Valida el estado HTTP y el valor explícito de `success`; conserva los campos ante errores, falta de conexión y activación pendiente, y evita envíos simultáneos. No reintenta automáticamente.
- Un formulario HTML POST con la protección predeterminada de FormSubmit queda como alternativa si no funciona JavaScript o el navegador no dispone de Fetch/AbortController. El retorno válido del proveedor usa `?enviado=1`.
- Las notificaciones del móvil se configuran en Gmail/Android. El formulario no puede habilitar los permisos del teléfono. El asunto identifica los avisos de BOXPLAYTV.

Documentación del proveedor: https://formsubmit.co/documentation

Comprobación: `node --test tests/contact.test.cjs`.
