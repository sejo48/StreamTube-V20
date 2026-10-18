# Box Play TV — borrador para revisión

Este documento registra el borrador previo a la aprobación de publicación del código. El panel conserva su modo borrador; publicar estas aplicaciones no publica automáticamente cambios de catálogos. La publicación de catálogos sigue deshabilitada. La sección Avisos permite publicar únicamente `avisos.json` con una credencial autorizada.

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

## Avisos en la aplicación e indicador del icono

La principal muestra una campana con el número de avisos sin leer. El panel permite marcar uno o todos como leídos y abrir la sección asociada. La lectura se conserva en el dispositivo y se sincroniza entre pestañas del mismo navegador. Los avisos vencidos quedan fuera del contador. Se consulta la lista al abrir/volver a la aplicación y cada minuto mientras está visible; no hay un servicio de notificaciones push para recibir nuevos mensajes con la app cerrada.

En plataformas compatibles se usa la API de indicadores de la app instalada para establecer o limpiar el contador del icono. El soporte depende del sistema/navegador; no se garantiza que aparezca en todos los móviles. Si el sistema requiere permiso, el panel ofrece «Activar indicador en el icono» y lo solicita solo tras pulsarlo. La campana sigue disponible aunque el sistema no admita indicadores.

En el administrador, **Avisos** permite escribir título/mensaje, elegir sección y duración, revisar una vista previa, publicar y retirar avisos. Son mensajes generales públicos; no contienen destinatarios ni datos privados de cuentas.

Para publicar, el administrador introduce en el campo de contraseña una credencial de GitHub autorizada para `sejo48/StreamTube-V20` con permiso **Contents: escritura**. Puede crear una credencial restringida a este repositorio desde los ajustes de desarrollador de GitHub. Se usa únicamente en memoria durante la visita a la sección; no se persiste en almacenamiento local, respaldos, código ni archivos publicados. No hace falta una credencial para leer avisos en la principal.

El archivo compartido es `avisos.json`, independiente de los catálogos. Se publica mediante una única actualización de GitHub con comprobación SHA contra conflictos. Tras publicarse, el sitio debe actualizarse antes de que los clientes reciban el aviso; el contador se actualizará al consultar la aplicación. Un reintento conserva la identidad del borrador para evitar duplicados si se perdió la respuesta.

Se ejecutaron 15 pruebas unitarias, `tests/notices-browser.cjs` y la prueba general de navegador. Verifican publicación/lectura, marcado, persistencia, expiración, limpieza del indicador, errores de permisos, conflictos, pérdida de respuesta, Unicode y ausencia de credenciales guardadas. Las escrituras de prueba de GitHub y el indicador del sistema fueron simulados: no se enviaron avisos de ejemplo a clientes ni se verificó visualmente un icono en un teléfono real. La lista inicial publicada está vacía.

## Administrador que utiliza el propietario

El administrador habitual está en `sejo48/admisboxplaytv` (https://sejo48.github.io/admisboxplaytv/), no en el `admin.html` adicional de este repositorio. También se incorporó Avisos allí, conservando Explorar TMDB y GitHub Sync. El enlace directo es https://sejo48.github.io/admisboxplaytv/#avisos y el botón «Enviar avisos» aparece en la barra superior. Ambos administradores publican la misma lista de avisos de StreamTube-V20.

## Administrador en producción y comprobación de credenciales

El administrador habitual de admisboxplaytv ahora publica HTML/CSS/JS precompilados desde fuentes en `src/`, con versiones de React/ReactDOM/HLS fijadas y dependencias locales para compilación. Su navegador no ejecuta Tailwind CDN ni Babel para transformar la aplicación.

La lista de avisos se abre mediante su fuente pública; no se usa automáticamente un token guardado para consultarla. Antes de publicar, el propietario pulsa «Comprobar conexión». Un 401 se identifica como token rechazado y un 403 como denegación de acceso. El borrador se conserva y la publicación queda bloqueada hasta que se compruebe una credencial válida. El propietario debe reemplazar el token rechazado directamente en el campo protegido del panel; el código no puede renovar una credencial de su cuenta de GitHub.

## Radio Digital 2026

La radio tiene un reproductor independiente, diseño adaptable, espectro de 48 bandas calculado con Web Audio, filtros por grupo y género, búsqueda y favoritos. Los indicadores muestran estados reales de conexión y reproducción. Se eliminaron las barras aleatorias y las afirmaciones de estabilidad y calidad no medidas.

La reproducción empieza por una acción del usuario dentro de Radio. Al salir se descarga la fuente, se destruye la sesión HLS y se desconecta el analizador; al volver hace falta pulsar Reproducir. Las señales sin CORS se intentan reproducir directamente sin barras cuando el navegador lo permite; si no se pueden reproducir, aparece un error y una opción de reintento. El catálogo y los avisos existentes no se modifican.

Verificación: seis pruebas del motor, integración en Chromium con una señal WAV de frecuencias conocidas y pruebas generales de la aplicación. Se verificaron muestras FFT reales, volumen, pausa, favoritos, filtros, alternativa sin CORS, errores, liberación al navegar y anchuras móviles de 320, 390 y 430 píxeles. Los permisos del navegador y la disponibilidad de cada emisora siguen dependiendo de su servidor y dispositivo.

## Inicio panorámico inspirado en la referencia

El inicio utiliza fondos panorámicos del catálogo, texto superpuesto y cinco destacados seleccionables. La selección utiliza exclusivamente Estrenos (peliculas2.json), ordenados por fecha de estreno, y muestra los cinco títulos más recientes que tengan un fondo panorámico válido. No utiliza Películas, Series ni Tendencias como fuentes alternativas. Excluye fechas futuras, fechas inválidas y registros sin fecha o año. Antes de mostrar un fondo, carga la imagen y comprueba que su proporción sea al menos 1,5:1; rechaza imágenes verticales, cuadradas y enlaces que no cargan, y continúa con el siguiente estreno más reciente. No sustituye el fondo por un póster. Cada selección tiene hasta cinco títulos distintos y la primera portada evita repetir la que estaba visible antes de recargar. Se recuerda localmente la portada mostrada para mantener esa diferencia entre recargas. El carrusel cambia cada nueve segundos y se pausa con el foco, al pasar el puntero, al ocultar la página o cuando se solicita reducir movimiento. Admite selección con flechas, Inicio y Fin, además de un botón de pausa.

Las filas de Tendencias, Estrenos, Películas, Series, Animados, Mi lista y Continuar viendo usan portadas horizontales desplazables y accesos para explorar cada sección. Tendencias permite explorar la colección completa; no se muestran cifras de reproducciones inventadas. Los próximos lanzamientos y sus tráileres se conservan al final. El administrador y los datos de catálogo no se modificaron.

Verificación: pruebas generales y pruebas del inicio en Chromium, incluyendo navegación al detalle correcto, favoritos guardados, controles por teclado, temporización y movimiento reducido, y anchos 320/390/430/1024/1440/1920. Las imágenes externas se sustituyen por imágenes de prueba en las comprobaciones sin conexión; sus enlaces de producción se conservan.

## Actualización de la portada al regresar

El catálogo vuelve a consultarse al entrar de nuevo en Inicio, al regresar a la pestaña o restaurar una página guardada por el navegador. La portada alterna el título inicial entre los cinco estrenos más recientes con imagen panorámica válida y mantiene los datos anteriores si falla la actualización. Los resultados de solicitudes canceladas no reemplazan un catálogo más nuevo. Se verificaron la exclusión de otras secciones y de fondos verticales, rotos o ausentes, el orden por fecha, el límite de cinco, los títulos únicos, cuatro recargas consecutivas sin repetir portada, y la recuperación al volver a Inicio, recuperar el foco y restaurar la página.

## Encuadre completo de la portada

La imagen principal utiliza exclusivamente fotografías panorámicas y las ajusta proporcionalmente completas. El fondo independiente desenfocado cubre los espacios sobrantes. El encuadre reserva el espacio de las miniaturas en PC y se coloca por encima del texto en móvil. Se verificaron fuentes panorámicas, 16:9 y ultrapanorámicas en anchos de 320 a 1920 píxeles, sin recortes de la imagen principal.
