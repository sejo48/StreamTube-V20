# Transmitir BOXPLAYTV al televisor

El botón **Transmitir** está dentro del reproductor de películas y episodios, después de los controles de suscripción y PIN. Selecciona un TV con Google Cast en la misma red Wi-Fi. El icono cambia a verde al enviar el video actual; al pulsarlo de nuevo se accede a pausa, avance, volumen y detener envío.

Se utiliza el Default Media Receiver oficial de Google, que no requiere registrar un receptor ni contratar alojamiento adicional. El TV debe poder abrir el enlace y admitir su formato. Se reconocen enlaces MP4, M4V, WebM, Ogg, HLS y DASH; un servidor puede impedir la reproducción por sus permisos, CORS o el códec utilizado. No se cargan videos automáticamente al conectar o reanudar una sesión.

Las páginas de vista previa de **Google Drive** y **OK.ru** no se entregan al receptor como si fueran archivos multimedia. En esos casos el panel ofrece instrucciones para duplicar la pestaña desde Chrome, la pantalla Android con Google Home y la pantalla de dispositivos compatibles con Miracast hacia Fire TV. Se incluye AirPlay cuando el reproductor y Safari lo ofrecen. La compatibilidad de Fire TV/Miracast y AirPlay depende de los dispositivos; no se simula soporte universal.

El módulo no extrae enlaces privados ni envía correo, PIN o credenciales de GitHub. Solo entrega la URL necesaria del video, título, subtítulo y portada al receptor elegido. La reproducción local se pausa solamente cuando se completa un envío solicitado desde ese reproductor. Detectar o reconectar una sesión del TV no pausa el móvil. Una respuesta atrasada de un envío anterior tampoco puede pausar la siguiente película. Al salir del reproductor se cancela un envío pendiente o se detiene el envío de ese título.

La pantalla completa se abre mediante su botón, sin un temporizador que cambie el modo después de comenzar la reproducción. Cuando el navegador no ofrece pantalla completa para el contenedor, se utiliza la opción nativa del video si está disponible, como en iPhone. Las actualizaciones de metadatos y de Cast mantienen el mismo video o iframe; las pausas elegidas por el usuario se respetan.

## Validación

```sh
node --test tests/cast.test.cjs
```

La prueba del reproductor requiere React 18, ReactDOM 18 y Babel Standalone, las mismas dependencias de desarrollo del administrador `admisboxplaytv`. Si ambos repositorios están juntos:

```sh
NODE_PATH=../admisboxplaytv/node_modules node --test tests/cast.test.cjs tests/cast-player.test.cjs
```

Las pruebas simulan la API oficial para comprobar selección, cancelación, metadatos, reproducción, controles remotos, errores y respuestas atrasadas. La compilación JSX comprueba el reproductor completo. La prueba de conexión física debe realizarse con un TV compatible: los tests no detectan ni utilizan televisores reales.

La regresión de reproducción móvil usa React Test Renderer 18.3.1 para ejecutar los efectos reales del componente con un video simulado. Para ejecutar las 22 pruebas en un entorno independiente:

```sh
npm install --prefix /tmp/boxplaytv-player-tests --no-audit --no-fund --ignore-scripts react@18.3.1 react-dom@18.3.1 react-test-renderer@18.3.1 @babel/standalone@7.28.5
NODE_PATH=/tmp/boxplaytv-player-tests/node_modules node --test tests/cast.test.cjs tests/cast-player.test.cjs tests/mobile-playback.test.cjs
```

Estas pruebas comprueban pausas locales, respuestas tardías, conservación del reproductor y las rutas de pantalla completa. No sustituyen una prueba en un teléfono físico ni garantizan la disponibilidad del servidor de Drive u OK.ru.

## Referencias oficiales

- https://developers.google.com/cast/docs/web_sender/integrate
- https://developers.google.com/cast/docs/web_receiver
- https://support.google.com/chrome/answer/3228332?hl=es
- https://support.google.com/chromecast/answer/6050397?hl=es
- https://digprjsurvey.amazon.co.uk/csad/help/node/ToUjwyfVuffzVfbR6b
- https://support.apple.com/es-es/102661
