# BOXPLAYTV para Smart TV

Dirección: https://boxplaytv.com/smart-tv.html

La navegación superior ofrece Estrenos, Películas y Series. Series consulta el mismo `playlist.json` que publica el administrador; no necesita una segunda copia del catálogo.

Al abrir una serie, elige una temporada y después un episodio. Los episodios sin enlace aparecen como «Próximamente» y no se pueden reproducir. Las series o temporadas vacías muestran un aviso. La búsqueda funciona sobre la sección elegida, sin distinguir tildes.

Las flechas y OK del control remoto permiten recorrer y elegir los botones. Volver desde el reproductor conserva la temporada y devuelve el foco al episodio elegido; Volver desde la ficha regresa a la portada. Los episodios utilizan la misma verificación de suscripción, clave de la serie y reproductor que las películas.

Prueba de integración con catálogos, autenticación y reproductores simulados, sin escrituras remotas:

```sh
NODE_PATH=/opt/codex/cua_node/lib/node_modules node tests/smart-tv-series-browser.cjs
```
