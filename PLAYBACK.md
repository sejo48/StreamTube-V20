# Reproducción de películas y episodios

## Propuesta: controles discretos y reconexión de Drive (22 de noviembre de 2026)

Los controles de BoxPlayTV pasan a una barra debajo de la imagen, que se oculta con el temporizador existente. El botón lateral se reduce a un acceso de puntos suspensivos con etiqueta accesible. Se retira el rótulo de calidad superpuesto en los reproductores integrados; los ajustes de calidad y tamaño se conservan para video directo.

En Drive, «Reconectar» vuelve a montar únicamente el iframe cuando la persona lo pulsa. No sale de BoxPlayTV ni cambia la película, episodio, suscripción o PIN. Ocultar el menú y actualizar el catálogo no recarga el video. Puede ser necesario pulsar Play y volver manualmente al minuto anterior: la página principal no puede leer la posición del reproductor de Drive.

Esta propuesta conserva el reproductor integrado de Drive y sus controles propios. No es un reemplazo completo del reproductor ni confirma la solución del congelamiento; faltan la prueba del usuario y una vía de acceso directo al video para sustituir también el visor de Google. El usuario reporta que el mismo video funciona directamente en Drive y se recupera tras cerrar Chrome y abrirlo de nuevo; la causa de las transferencias incompletas sigue sin confirmarse.

Validación: 17 pruebas Node aprobadas, compilación del JSX y comprobación de sintaxis de picture-quality.js. Prueba visual con iframe simulado a 1363 px, 360 px y 640 × 360 px: barra fuera de la imagen, controles móviles de al menos 44 px y reconexión manual. La simulación no ejecuta la reproducción remota ni verifica la recuperación de un video congelado en Google Drive.

Se retira la integración de Google Cast a petición del propietario, tras pausas repetidas reportadas tanto en Android como en el televisor después de activarla. La causa concreta dentro del SDK o del dispositivo no está confirmada.

El reproductor recupera el comportamiento anterior a esa integración: Drive y OK.ru usan sus reproductores integrados, y MP4/HLS utilizan el elemento de video. Se conservan la detección correcta del dominio de OK.ru y su campo alternativo `urlOkRu`. No se carga el SDK de Cast, no se inicializan sesiones remotas y no se muestra su botón. Se eliminan el módulo, los estilos y las pruebas específicas de esa función. No se incorpora el cambio experimental que abría Drive por separado en móviles.

El catálogo, el código de instalación 5134842, los siete títulos de continuar viendo y los controles de suscripción/PIN permanecen en la aplicación.

## Validación

```sh
npm install --prefix /tmp/boxplaytv-player-tests --no-audit --no-fund --ignore-scripts react@18.3.1 react-dom@18.3.1 react-test-renderer@18.3.1 @babel/standalone@7.28.5
NODE_PATH=/tmp/boxplaytv-player-tests/node_modules node --test tests/player.test.cjs
```

Las seis pruebas verifican que no se carga Cast, la compilación JSX, los accesos de suscripción/PIN, la URL real de Road Wars en Android y TV, otros formatos y la conservación del reproductor durante actualizaciones. El video simulado comprueba que no se solicitan pausas ni recargas durante esas actualizaciones.

Pendiente de validación en el móvil y televisor del propietario: cerrar por completo la aplicación, abrirla de nuevo y comprobar que ya no aparece el icono de transmitir. Después reproducir Road Wars durante varios minutos. Las pruebas automáticas no ejecutan el reproductor remoto de Google Drive ni simulan el firmware del televisor.

## Pantalla completa y menú (6 de noviembre de 2026)

Películas y TV comparten `player-ui.js` y `player-ui.css`. El botón de pantalla completa se pulsa dentro del reproductor, sin solicitudes diferidas que pierdan el gesto del usuario. Se siguen los eventos estándar y WebKit para actualizar el estado. Si la API falta o rechaza la solicitud, se ocupa la ventana del navegador; «Salir de pantalla completa» o Escape restauran la vista.

El menú de películas se oculta tras 3,5 segundos de inactividad. En TV, la barra se oculta automáticamente durante pantalla completa. El botón «Mostrar/Ocultar menú» permanece accesible sobre los reproductores integrados. Los controles conservan el menú mientras tienen foco del teclado. Los iframes y videos permanecen montados al ocultar el menú y cambiar de modo. Se conserva la proporción del video directo.

Verificación: 66 pruebas Node, incluidas entrada/salida estándar y WebKit, rechazo de la API, alternativa sin soporte, Escape, temporizadores y recuperación del menú. No se ejecutó navegador ni hardware real en esta sesión; los controles internos de Drive/OK.ru siguen dependiendo del proveedor y no pueden manipularse desde la página principal.

## Imagen y calidad (17 de noviembre de 2026)

La web, TV en vivo y smart-tv.html cargan picture-quality.js. En video directo, Imagen alterna entre ajustar a pantalla (contain) y tamaño original sin ampliar (scale-down), conservando proporciones. La elección se guarda por dispositivo. No se recarga el video al cambiarla. En HLS con varias variantes, Calidad alterna automática y máxima; máxima elige por resolución y bitrate y consume más datos. Automática permite bajar calidad si la conexión lo necesita. Los reproductores integrados de Drive/OK.ru conservan sus controles: no se manipulan ni se promete aumentar su resolución. La aplicación Android TV que abre un reproductor nativo sigue usando los ajustes de ese reproductor; estas opciones pertenecen al reproductor web. No se añade IA ni filtros de nitidez.

Los botones de Smart TV entran en la navegación con flechas/OK y conservan la barra mientras tienen foco. Pruebas: node tests/picture-quality.test.cjs y node --check de los scripts modificados. Pendiente verificación visual en móvil, PC y hardware Smart TV real.
