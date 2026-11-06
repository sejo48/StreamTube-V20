# Reproducción de películas y episodios

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
