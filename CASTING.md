# Transmitir BOXPLAYTV al televisor

El botón **Transmitir** está dentro del reproductor de películas y episodios, después de los controles de suscripción y PIN. Selecciona un TV con Google Cast en la misma red Wi-Fi. El icono cambia a verde al enviar el video actual; al pulsarlo de nuevo se accede a pausa, avance, volumen y detener envío.

Se utiliza el Default Media Receiver oficial de Google, que no requiere registrar un receptor ni contratar alojamiento adicional. El TV debe poder abrir el enlace y admitir su formato. Se reconocen enlaces MP4, M4V, WebM, Ogg, HLS y DASH; un servidor puede impedir la reproducción por sus permisos, CORS o el códec utilizado. No se cargan videos automáticamente al conectar o reanudar una sesión.

Las páginas de vista previa de **Google Drive** y **OK.ru** no se entregan al receptor como si fueran archivos multimedia. En esos casos el panel ofrece instrucciones para duplicar la pestaña desde Chrome, la pantalla Android con Google Home y la pantalla de dispositivos compatibles con Miracast hacia Fire TV. Se incluye AirPlay cuando el reproductor y Safari lo ofrecen. La compatibilidad de Fire TV/Miracast y AirPlay depende de los dispositivos; no se simula soporte universal.

El módulo no extrae enlaces privados ni envía correo, PIN o credenciales de GitHub. Solo entrega la URL necesaria del video, título, subtítulo y portada al receptor elegido. La reproducción local se pausa cuando el TV acepta el video. Al salir del reproductor se cancela un envío pendiente o se detiene el envío de ese título.

## Validación

```sh
node --test tests/cast.test.cjs
```

La prueba del reproductor requiere React 18, ReactDOM 18 y Babel Standalone, las mismas dependencias de desarrollo del administrador `admisboxplaytv`. Si ambos repositorios están juntos:

```sh
NODE_PATH=../admisboxplaytv/node_modules node --test tests/cast.test.cjs tests/cast-player.test.cjs
```

Las pruebas simulan la API oficial para comprobar selección, cancelación, metadatos, reproducción, controles remotos, errores y respuestas atrasadas. La compilación JSX comprueba el reproductor completo. La prueba de conexión física debe realizarse con un TV compatible: los tests no detectan ni utilizan televisores reales.

## Referencias oficiales

- https://developers.google.com/cast/docs/web_sender/integrate
- https://developers.google.com/cast/docs/web_receiver
- https://support.google.com/chrome/answer/3228332?hl=es
- https://support.google.com/chromecast/answer/6050397?hl=es
- https://digprjsurvey.amazon.co.uk/csad/help/node/ToUjwyfVuffzVfbR6b
- https://support.apple.com/es-es/102661
