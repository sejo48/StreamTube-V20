# Doramas

La sección Doramas reúne películas y series asiáticas en `doramas.json`. Empieza vacía y está disponible en la navegación de la aplicación, en Más del móvil y en Smart TV.

Para incorporar títulos, usa https://sejo48.github.io/admisboxplaytv/#doramas. Elige película o serie, completa la ficha y los enlaces; para series, añade temporadas y episodios. Guarda y publica con GitHub Sync, después actualiza el catálogo en la aplicación principal. Los controles de suscripción y PIN son los mismos que para los demás contenidos.

El archivo es una lista JSON. Cada título admite `titulo`, `descripcion`, `imagen`, `tmdbType` (`movie` o `tv`), metadatos TMDB, `urlDrive`, `codigo` y `qualityTag`. Las series usan `temporadas` con `numeroTemporada` y `episodios` (`tituloEpisodio`, `urlDrive`). El panel de borradores integrado también conserva Doramas en sus respaldos y revisiones.
