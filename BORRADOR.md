# Box Play TV — borrador para revisión

Este documento registra el borrador previo a la aprobación de publicación del código. El panel conserva su modo borrador; publicar estas aplicaciones no publica automáticamente cambios de catálogos. El panel no contiene llamadas de escritura a GitHub, formulario de token ni botón de publicación.

## Probar las aplicaciones

Desde este directorio:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra `index.html` y `admin.html` mediante el servidor HTTP. No abra los HTML directamente con `file://`. Las aplicaciones originales usan React, Babel y Tailwind desde CDN; se necesita acceso a esas dependencias. Firebase, imágenes, emisoras, vídeo y Chromecast siguen siendo servicios externos.

1. En la principal, pulse **Comenzar Experiencia** y **Actualizar catálogo**.
2. En administración, edite una película y guárdela. El cambio permanece en el navegador.
3. Pulse **Revisar borrador → Validar y revisar cambios**. Aparecen los ocho catálogos con nuevos, modificados y eliminados.
4. **Descargar borrador y respaldo** guarda `boxplaytv_borrador.json`. Contiene `baseline` (versión anterior), `datasets` (versión propuesta), resumen y errores de validación. No publica nada ni contiene credenciales.
5. **Restaurar respaldo en el panel** pide confirmación y restaura únicamente el estado local. El botón **Backup** conserva los IDs. El botón **Importar** también admite el borrador descargado y restaura sus datos propuestos.

## Cambios

- `catalog-config.json` fija el repositorio, rama y modo borrador para ambas aplicaciones.
- `catalog.js` comparte lectura estricta, identificación, validación, resúmenes, serialización y respaldo. Una descarga fallida nunca se interpreta como catálogo vacío. Las fuentes locales se usan primero; solo un HTTP 404 permite el respaldo remoto configurado.
- Todos los catálogos conservan IDs al editar, exportar e importar. Las series conservan IDs de episodios y temporadas. TV admite `tvg-id` en M3U.
- Los catálogos antiguos reciben IDs deterministas al cargarse. El borrador exportado persiste esos IDs y referencias de migración. No se modificaron los JSON/M3U originales del repositorio.
- La principal migra favoritos y referencias de episodios vistos; la migración de favoritos antiguos con títulos ambiguos conserva el registro original para no asociarlo a otro contenido.
- La actualización conserva la selección/reproducción actual y las listas personales. Ante un error mantiene el catálogo anterior. Solo actualiza el contenido cuando todas las descargas requeridas terminan.
- El panel conserva los cambios locales ante errores y muestra el catálogo que falló. Las exportaciones individuales y los respaldos retienen IDs y metadatos.

## Inicio móvil

Por debajo de 640 px se muestra un encabezado compacto con búsqueda, recomendación a todo el ancho con imagen de fondo y controles superpuestos, filas deslizables y navegación inferior Inicio / Películas / Series / TV / Más. El bloque de recomendación ocupa aproximadamente el 58% de la altura visible, entre 340 y 510 px. Usa `backdrop` si existe, con portada como respaldo. El detalle conserva la sinopsis completa.

Cuando hay historial, Continuar viendo aparece justo después de la recomendación y permite abrir el último episodio guardado. No se inventan porcentajes de reproducción: los datos actuales guardan el episodio, pero no el tiempo reproducido.

Favoritos, estrenos, radio, actualización del catálogo, instalación y compartir siguen accesibles desde Más. A partir de 640 px se conservan la distribución y dimensiones anteriores de PC/tablet.

Se verificaron 360, 390 y 430 px sin desbordamiento horizontal y se compararon las medidas del encabezado, portada, recomendación y contenido de PC (1280 px) con la versión anterior.

## Datos existentes que requieren revisión

La validación del borrador original detectó seis problemas en los catálogos de ese momento; los datos de GitHub pueden haber cambiado desde esa revisión:

- `peliculas2.json`: enlaces ausentes o inválidos en **Cuenta atrás**, **En un abrir y cerrar de ojos** y **Avatar: Fuego y ceniza**.
- `playlist.json`: **Misión: Imposible** no tiene temporadas.
- `playlist.json`: un **Episodio 4** repetido en **Los Locos Addams** genera una identidad duplicada.
- `listaoficial.m3u`: una entrada repetida de **Extrema TV** genera una identidad duplicada.

No se inventaron enlaces ni se eliminaron entradas. Estos problemas aparecen en la revisión del panel; descargar el borrador sigue permitido, pero su validación indica que necesita corrección.

## Validación ejecutada

```sh
node --test tests/catalog.test.cjs
```

Nueve pruebas unitarias pasan. Cubren IDs, progreso antiguo, resumen, respaldo, descargas fallidas, destino compartido, validación, conservación de metadatos y ausencia de escritura a GitHub.

`tests/browser-smoke.cjs` pasa en Chromium: carga del panel, descarga del borrador, edición y restauración local, bloqueo ante fallo de descarga, actualización de la principal, migración de favoritos/progreso y ausencia de excepciones JavaScript o peticiones de escritura.

La prueba de navegador usa paquetes locales verificados de React/Babel/HLS y CSS compilado de Tailwind, porque los CDN siguen bloqueados en este entorno. Excluye Firebase y servicios de reproducción; no afirma haber probado suscripciones, reproducción externa ni Chromecast.

Para reproducir esa prueba se requieren Playwright 1.61.1, React/ReactDOM 18.3.1, Babel standalone 7.28.5, HLS.js 1.6.16 y Tailwind 3.4.17, instalados fuera del checkout. En la máquina actual:

```sh
NODE_PATH=/workspace/streamtube-tools/node_modules BOXPLAY_TEST_CSS=/workspace/streamtube-tools/browser-test.css node tests/browser-smoke.cjs
```

## Pendiente antes de publicar

Para habilitar la publicación de catálogos desde el panel se requiere corregir los datos que señale la validación actual y aprobar esa funcionalidad. La publicación futura deberá escribir los ocho catálogos en un único commit, comprobar que la versión base no cambió y conservar la anterior para volver atrás. Ese mecanismo de publicación remota queda fuera de este borrador: la ruta anterior que publicaba archivos por separado fue retirada. No hay publicación automática al aceptar o descargar un archivo.

La integración de videoteca en la principal y la administración de suscripciones no forman parte de esta primera etapa.

## Precio y renovación

Los avisos de pago y la sección de acceso indican ₡3.000 por 30 días, sin cobros automáticos ni obligación de renovar. El cliente puede retirarse en cualquier momento y solo paga otro período si desea continuar. Los mensajes de acceso vencido ofrecen renovar como una opción.

Se retiró la fecha de vencimiento fija que mostraba la interfaz. La fecha y el tiempo restante se muestran únicamente a partir del resultado de verificación de la cuenta. Antes de verificar se pide consultar el acceso; no se muestra una fecha inventada. La fecha se presenta en horario de Costa Rica.

Se comprobó en 360 y 1280 px con respuestas de verificación simuladas (vigente y vencida); no se hicieron escrituras ni cobros de prueba en Firebase. Este ajuste no cambia las fechas de cuentas existentes: siguen administrándose en Firebase.

## Bienvenida automática

La pantalla de bienvenida reemplaza la atribución personal por «Tu entretenimiento, en un solo lugar». Entra al inicio automáticamente después de 2 segundos; el botón permite entrar de inmediato. El temporizador se limpia al salir y no se reinicia al actualizar los catálogos. Se comprobó sin clic en móvil y PC (aproximadamente 2,05 segundos), y se retiró el porcentaje de carga simulado.

## Agregar a pantalla de inicio

Más incluye «Agregar a pantalla de inicio». Se añadieron `manifest.webmanifest`, iconos 192/512, metadatos de iOS, captura temprana de la solicitud de instalación y un service worker de red sin caché de catálogo ni contenido Premium.

En navegadores compatibles el botón abre la solicitud del sistema. La confirmación del usuario es obligatoria; no se instala automáticamente ni se insiste cuando se rechaza. Cuando no hay solicitud disponible muestra pasos para Chrome/Android o Safari/iPhone. En modo independiente o tras confirmarse la instalación muestra «Aplicación agregada».

La app instalada requiere Internet. El service worker muestra un aviso de conexión ante navegación sin red, sin guardar una versión antigua de los catálogos. Se verificaron el manifest, dimensiones reales de los iconos, registro del service worker y flujos del botón con eventos de instalación simulados. Se comprobaron instrucciones específicas para iPhone con su agente de navegador; no se efectuó una instalación real en un teléfono desde este entorno.
