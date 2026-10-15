# Preview Suite — Moodle y Markdown

Editor y previsualizador de documentos académicos con HTML, Markdown, fórmulas LaTeX, bloques de código y diagramas Mermaid. **Vercel es el alojamiento principal**; la aplicación funciona en el navegador y no necesita un servidor de aplicación ni una base de datos.

- [Aplicación en Vercel](https://preview-suite.vercel.app)
- [Modo Moodle](https://preview-suite.vercel.app/#moodle)
- [Modo Markdown](https://preview-suite.vercel.app/#markdown)
- Versión: **3.3.0** · Autor: **Klever López** · [Licencia MIT](LICENSE)

## Uso

1. Abre la aplicación y elige Moodle o Markdown.
2. Escribe, pega o carga un archivo de texto. La vista previa se actualiza después de una pausa de 300 ms.
3. Usa **Guardar** para descargar el texto del modo actual, **Copiar** para copiarlo o **Imprimir** para abrir el diálogo de impresión/PDF del navegador.
4. El logotipo vuelve al menú. Las tarjetas y los enlaces `#moodle` y `#markdown` permiten abrir el borrador existente de cada modo.
5. Si cambias de formato con un documento modificado, puedes transformar una copia o abrir la plantilla del destino. Cuando el destino contiene un borrador se solicita confirmación antes de reemplazarlo; el reemplazo se puede deshacer en ese modo.

### Moodle / HTML

Previsualiza contenido HTML académico, tablas y avisos. El inspector señala etiquetas `table`/`pre` desbalanceadas, cierres matemáticos huérfanos y errores de KaTeX. La validación es heurística: no certifica HTML válido ni reproduce todos los temas, filtros y plugins de Moodle.

Por seguridad se eliminan scripts, manejadores de eventos, formularios, iframes y estilos globales del contenido. Se conservan estilos inline de presentación permitidos; las clases e identificadores importados se restringen para evitar interferencias con la aplicación. El texto fuente del editor sigue disponible al guardar o copiar.

### Markdown

- Encabezados, énfasis, enlaces, imágenes, citas, listas y tablas GFM con alineación.
- Tareas `- [ ]` y `- [x]`, tachado `~~texto~~`, resaltado `==texto==` y notas al pie `[^nota]` / `[^nota]: Definición`.
- Notas con continuación indentada con cuatro espacios y referencias repetidas con enlaces de retorno independientes.
- Alertas `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` y `> [!CAUTION]`, con títulos opcionales.
- Código cercado con etiqueta de lenguaje y botón de copia. Las extensiones de texto respetan el código literal.
- Diagramas en bloques `mermaid`, con copia de fuente y SVG. Se procesan en modo estricto, sin callbacks ni enlaces ejecutables.
- HTML de presentación, como `details`, `summary` y `kbd`, sujeto a la política de sanitización.

### Fórmulas y diagramas

KaTeX procesa `\( ... \)` y `$...$` en línea; `\[ ... \]` y `$$ ... $$` en bloque. No se interpretan fórmulas dentro de bloques de código. Las fórmulas se preservan antes de dividir tablas para que sus barras verticales no creen columnas adicionales.

Los diagramas se generan con Mermaid. La vista previa y la transformación admiten hasta **20 diagramas** por documento, con **50 000 caracteres** por diagrama. Una sintaxis inválida muestra un aviso; la exportación no informa éxito si no puede generar el diagrama.

### Transformaciones

**Markdown → Moodle:** genera HTML de documento, sin botones de la interfaz ni marcadores de carga. Los diagramas se incluyen como imágenes SVG embebidas en datos, con su fuente editable guardada en un atributo del documento. Las fórmulas mantienen sus delimitadores para los filtros matemáticos del destino. Las tareas exportan símbolos de verificación.

**HTML → Markdown:** usa Turndown con reglas GFM y reglas de la suite para imágenes, listas anidadas, numeración inicial, código, avisos y diagramas exportados. Las tablas con celdas combinadas se conservan como HTML para mantener su estructura. La conversión no garantiza conservar estilos o características arbitrarias de cualquier página web.

**Comprueba el HTML exportado en tu instalación de Moodle.** Sus filtros pueden retirar imágenes `data:`, SVG o atributos personalizados, y el renderizado matemático depende de la configuración de Moodle. La suite no publica contenido en Moodle.

## Borradores y límites

Cada modo conserva un borrador en `localStorage` del navegador. Se intenta guardar después de editar y al ocultar o abandonar la página. Los borradores se recuperan al recargar en el mismo origen; no se envían a un servidor ni se sincronizan entre dispositivos. Cambiar de dominio de Vercel o usar una URL de preview diferente da acceso a un almacenamiento distinto.

Si el navegador bloquea el almacenamiento o agota su cuota, se muestra un aviso para descargar una copia. El guardado local no es una copia de seguridad: borrar datos del navegador elimina los borradores. **Guardar** descarga un archivo independiente.

- Archivos admitidos: `.html`, `.htm`, `.md`, `.markdown` y `.txt`.
- Máximo: **5 MB** por archivo o documento pegado/escrito. Se rechazan archivos con bytes nulos.
- Historial independiente por modo: hasta **50 estados** y aproximadamente **16 MB** de texto UTF-16 por historial. Un documento que consume todo el presupuesto puede dejar menos estados disponibles.
- Numeración de líneas con un máximo de 2 000 marcadores visibles para limitar el tamaño del DOM.

## Teclado y vistas

| Atajo | Acción |
| --- | --- |
| Tab / Shift+Tab | Indentar / quitar indentación sin borrar la selección |
| Ctrl/Cmd+Z | Deshacer |
| Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z | Rehacer |
| Ctrl+Shift+C | Copiar el texto del editor |
| Ctrl+Enter | Actualizar la vista previa |
| Ctrl/Cmd+rueda, + o − | Ajustar fuente o zoom del panel |
| Ctrl/Cmd+0 | Restablecer fuente y zoom |
| Ctrl+P | Imprimir / guardar PDF desde el navegador |
| Escape | Cerrar diálogos y ajustes flotantes |

Las tarjetas del menú y los controles con apariencia de botón admiten Enter/Espacio. Los modales trasladan y contienen el foco, desactivan el fondo y devuelven el foco al cerrarse. El divisor de paneles admite flechas. En móvil se puede elegir editor, vista previa o ambos paneles. Estas mejoras cuentan con regresiones automatizadas; no constituyen una certificación WCAG completa.

## Desarrollo local

Requisitos: **Node.js 22 o posterior** y npm. La compilación produce un sitio estático:

```sh
npm ci
npm run build
npm start
```

Abre [localhost:8000](http://localhost:8000). El servidor local aplica las mismas cabeceras declaradas para Vercel. `PORT` permite cambiar el puerto.

El punto de entrada es `js/main.js`. Las fuentes, KaTeX, Mermaid, Marked, Prism y los conversores se empaquetan desde versiones exactas del archivo de bloqueo. Prism carga gramáticas adicionales desde el propio sitio. **Las funciones principales no descargan scripts ni fuentes desde un CDN.** El vídeo opcional de `surprise.html` usa YouTube; las imágenes externas que incluya el documento necesitan su servidor de origen.

No se abre el `index.html` fuente mediante doble clic: los módulos y recursos se preparan con la compilación y se sirven por HTTP. Para trabajar sin Internet, prepara primero `dist/` y sírvelo localmente. No hay service worker ni promesa de recarga sin conexión de la página alojada en Vercel. Si Marked no está disponible durante la ejecución, existe un respaldo reducido para encabezados, código, citas, alertas y negritas; no ofrece paridad con todo Markdown.

## Despliegue en Vercel

El historial del proyecto documenta la integración de GitHub con Vercel para la rama `main`. La configuración versionada está en [vercel.json](vercel.json):

| Ajuste | Valor |
| --- | --- |
| Framework | Other / sitio estático |
| Instalación | `npm ci` |
| Compilación | `npm run build` |
| Carpeta publicada | `dist` |

No requiere secretos ni variables de entorno de la aplicación. Los hashes `#moodle` y `#markdown` se resuelven en el navegador y no requieren reglas de reescritura. Las cabeceras incluyen CSP con scripts del propio origen, `nosniff`, política de referente y bloqueo de incrustación del sitio. Se permiten estilos inline para el formato académico y el layout dinámico.

La integración existente podrá publicar estos cambios cuando se suban a la rama conectada. **Un build local satisfactorio no confirma que se haya desplegado la nueva versión.** La configuración y el estado del proyecto remoto de Vercel deben comprobarse en el despliegue correspondiente.

El repositorio conserva `.nojekyll` por su origen en GitHub Pages. Cualquier espejo debe publicar el contenido compilado de `dist/`; publicar directamente la raíz fuente ya no genera una instalación funcional.

## Calidad y pruebas

```sh
npm run lint
npm run build
npm test
# Todo lo anterior:
npm run check
```

Las pruebas de historial usan `node:test`. Las de navegador usan Playwright con Edge en Windows y Chromium en CI. En CI se instala el navegador con `npx playwright install --with-deps chromium`. Los resultados y capturas se guardan en `test-results/`, que no se versiona.

El flujo [.github/workflows/check.yml](.github/workflows/check.yml) ejecuta formato, lint, build y regresiones en pushes y pull requests. Las pruebas comprueban flujos de edición, importación/exportación, recuperación de borradores, fórmulas, seguridad con y sin CSP, accesibilidad por teclado y controles de vista e impresión.

La [auditoría inicial](audit/AUDITORIA.md) y [sus resultados](audit/results.json) conservan la evidencia de la versión anterior. El [registro de correcciones](audit/CORRECCIONES.md) detalla los cambios y sus límites de validación. Consulta también el [CHANGELOG](CHANGELOG.md).

## Organización

```text
js/
  main.js             Entrada y orden de inicialización
  vendor.js           Dependencias y recursos locales
  config.js           Límites y plantillas
  content-safety.js   Sanitización, URLs y aislamiento de clases/IDs
  history.js          Historial acotado e independiente del DOM
  dialogs.js          Ciclo de foco y modalidad
  diagrams.js         Cola y configuración de Mermaid
  markdown.js         Parseo, conversión y exportación
  linter.js           Inspector heurístico del código fuente
  app.js              Coordinación de documentos y controles
css/                  Estilos del hub, editor e impresión
scripts/              Compilación y servidor local
tests/                Pruebas unitarias y de navegador
audit/                Evidencia y seguimiento de la auditoría
vercel.json           Build, publicación estática y cabeceras
```

Las dependencias exactas y sus versiones se consultan en [package.json](package.json) y [package-lock.json](package-lock.json).
