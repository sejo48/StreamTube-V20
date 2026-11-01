# BOXPLAYTV para Smart TV

Dirección: https://boxplaytv.com/smart-tv.html

La navegación superior ofrece Estrenos, Películas y Series. Series consulta el mismo `playlist.json` que publica el administrador; no necesita una segunda copia del catálogo.

Al abrir una serie, elige una temporada y después un episodio. Los episodios sin enlace aparecen como «Próximamente» y no se pueden reproducir. Las series o temporadas vacías muestran un aviso. La búsqueda funciona sobre la sección elegida, sin distinguir tildes.

Las flechas y OK del control remoto permiten recorrer y elegir los botones. Volver desde el reproductor conserva la temporada y devuelve el foco al episodio elegido; Volver desde la ficha regresa a la portada. Los episodios utilizan la misma verificación de suscripción, clave de la serie y reproductor que las películas.

Prueba de integración con catálogos, autenticación y reproductores simulados, sin escrituras remotas:

```sh
NODE_PATH=/opt/codex/cua_node/lib/node_modules node tests/smart-tv-series-browser.cjs
```

## Recorrido con el mando

En la ficha de una serie, pulsa Abajo desde la temporada para entrar a los episodios. Abajo avanza y Arriba retrocede: al terminar los episodios visibles, la página cambia automáticamente. El contador indica el tramo y el total de la temporada (por ejemplo, «Episodios 13–24 de 36»). También hay botones Anteriores y Siguientes. OK reproduce y Volver sale del reproductor o de la ficha. Se reconocen los códigos estándar de flechas/OK y los botones Volver de Samsung/LG, además de la interfaz nativa boxTV.

La ficha muestra doce episodios por página en una cuadrícula de tres columnas, con filas compactas de tamaño fijo. Izquierda/Derecha recorre los episodios; Arriba/Abajo cambia de fila; al avanzar más allá de la página, se muestran los siguientes.

Durante la reproducción, «← Volver» permanece visible en la esquina superior izquierda aunque se oculte la barra inferior. Atrás del navegador/mando sale del reproductor y regresa a la ficha. En el navegador, el foco vuelve a los controles de la aplicación después de activar el reproductor externo; el proveedor no puede abrir un fullscreen propio que tape la salida.
