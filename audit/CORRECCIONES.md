# Correcciones de la auditoría — Preview Suite 3.3.0

Fecha: 15 de octubre de 2026. Alojamiento de referencia: **Vercel**, según el README y el historial del proyecto.

Se corrigieron las causas de los 15 hallazgos de la auditoría inicial y se añadieron regresiones. Los archivos de la auditoría de 3.2.1 se conservan como evidencia histórica; no describen el estado actual.

## Cambios por hallazgo

| Hallazgo original | Corrección aplicada |
| --- | --- |
| 1. Ejecución desde contenido importado | DOMPurify para HTML/SVG, validación de enlaces, bloqueo de estilos globales, clases e IDs del documento separados de los de la aplicación. Mermaid estricto, sin directivas que debiliten la seguridad. CSP en Vercel como protección adicional. |
| 2. Pérdida de borradores al cambiar de modo | La navegación reutiliza el borrador. Los reemplazos explícitos requieren confirmación cuando existe trabajo en el destino y se registran en su historial. |
| 3. Deshacer/rehacer con registros pendientes | Historial independiente del DOM, consolidación antes de deshacer y cancelación de temporizadores al navegar. Límites por estados y memoria. |
| 4. Pérdidas HTML → Markdown | Turndown con reglas GFM y de la suite: imágenes, listas anidadas, numeración, texto literal, código y tablas complejas. |
| 5. Exportación de Mermaid a Moodle | Exportación asíncrona de documento sin controles de la interfaz; SVG como imagen embebida y fuente editable conservada. Los errores cancelan la transformación. |
| 6. Notas al pie sobre código | Definiciones y referencias mediante extensiones del parser, contenido enriquecido y referencias únicas con retorno. |
| 7. Resaltado sobre código | Extensión inline de Marked; no se aplica una sustitución global sobre bloques de código. |
| 8. Tab destruye la selección | Indentación y desindentación de las líneas seleccionadas, sin borrar contenido. |
| 9. Lectura de archivo obsoleta | Identificador de operación, revisión de documento y modo capturados al iniciar. Se descartan lecturas que ya no corresponden. |
| 10. Linter ignora orden/trunca el análisis | Recorrido de tokens en orden, cierres huérfanos, exclusión de comentarios/ejemplos y eliminación del corte a 10 000 líneas. |
| 11. Prism C++ sin C | C se importa antes de C++; los lenguajes adicionales se sirven desde recursos locales. |
| 12. Accesibilidad de controles/modales | Foco inicial y retorno, contención del foco, fondo inactivo, Enter/Espacio, divisor con flechas y botón Deshacer realmente deshabilitado. |
| 13. Éxito falso al copiar | Resultado explícito del portapapeles, alternativa de copia comprobada y actualización visual solo después del éxito. |
| 14. Respaldo Markdown inoperante | Procesamiento estructurado y escapado de citas/alertas; alcance reducido documentado. |
| 15. Tablas sin encabezado semántico | `thead` y `tbody`, alineación conservada y envoltorios responsivos para tablas Markdown y HTML mezcladas. |

También se añadieron persistencia local de borradores con avisos de cuota, límite de tamaño para ediciones, numeración virtualizada, conservación de posición por modo, corrección del foco inicial del editor y mensajes de error para fórmulas y diagramas inválidos.

## Ingeniería y despliegue

- Dependencias y fuentes locales con versiones exactas y `package-lock.json`; el navegador carga el núcleo desde Vercel.
- Separación de historial, sanitización, diálogos, renderizado de diagramas y coordinación de la aplicación.
- Build estático con esbuild; salida `dist/` y configuración versionada en `vercel.json`.
- Cabeceras CSP, `nosniff`, política de referente, permisos y bloqueo de incrustación.
- ESLint, Prettier, pruebas de historial, servidor y navegador; flujo de GitHub Actions.
- README reescrito para describir Vercel, recuperación local, transformaciones, límites y comprobaciones pendientes del destino Moodle.

La configuración de build y cabeceras sigue el mecanismo de [configuración estática de Vercel](https://vercel.com/docs/project-configuration/vercel-json). La política de sanitización usa las interfaces documentadas de [DOMPurify](https://github.com/cure53/DOMPurify). Se usa la opción global `htmlLabels` de [Mermaid](https://mermaid.js.org/config/directives), manteniendo texto SVG para conservar etiquetas sin `foreignObject`.

## Validación

La evidencia final se guarda en [validacion-3.3.0.json](validacion-3.3.0.json), con versión de la aplicación, navegador, hash de la compilación, expectativas y resultados. Se reproduce con `npm ci`, `npm run check` y Edge en Windows; CI utiliza Chromium.

Se ejecutaron lint, verificación de formato, build, pruebas de historial y servidor y la suite de navegador. Se probaron flujos normales y entradas problemáticas, seguridad sin depender de CSP, cuotas de almacenamiento, notas repetidas, fórmulas en tablas, documentos de 15 000 líneas y diez familias de diagramas. El servidor se comprobó mediante HTTP real para verificar cabeceras, rutas públicas y exclusión de archivos del repositorio. La mayoría de las pruebas de interfaz usan una ruta controlada sobre los archivos compilados con las cabeceras de Vercel.

Resultado: **119 comprobaciones de navegador y cuatro pruebas de historial/servidor satisfactorias**, sin errores de JavaScript no controlados. ESLint, formato y compilación también finalizaron correctamente.

Se inspeccionaron capturas de escritorio, móvil y diagramas, y se generó un PDF con el modo de impresión. Estos artefactos se regeneran en `test-results/`. La revisión de dependencias de producción con `npm audit --omit=dev` no reportó vulnerabilidades conocidas en la ejecución del 15 de octubre de 2026; no equivale a garantizar ausencia de vulnerabilidades.

## Límites y estado de publicación

**Esta corrección se realizó en el repositorio local. No se publicó un nuevo despliegue ni se cambió la configuración remota de la cuenta de Vercel.** La integración de GitHub documentada por el proyecto podrá ejecutar el nuevo build al subir los cambios a la rama conectada. Hay que comprobar ese despliegue para confirmar la versión y las cabeceras efectivamente servidas en producción.

No se accedió a una instalación real de Moodle. Su política de limpieza puede retirar imágenes `data:`, SVG o atributos; sus temas y filtros matemáticos pueden producir diferencias. La prueba de un documento exportado en el Moodle del usuario sigue siendo una validación de integración pendiente.

Las pruebas locales se ejecutaron en Edge. El flujo de Chromium en GitHub está configurado, pero esta sesión no ejecutó un job remoto. No se afirma cobertura total de ramas, certificación WCAG, validación visual exhaustiva en todos los navegadores ni un ensayo de saturación con todas las combinaciones posibles de documentos.
