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
