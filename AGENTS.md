# FutApp: criterios para cambios

- Mantener el backend hexagonal: reglas sin I/O en `domain`, casos de uso y puertos
  en `application`, implementaciones en `adapters`, composición en `container.ts`.
- Mantener Atomic Design en frontend: controles en `atoms`, combinaciones pequeñas
  en `molecules`, paneles/formularios en `organisms`, estructura en `templates` y
  composición de rutas en `pages`. Consultas y estado de interacción van en hooks
  o servicios, sin convertir las páginas en formularios monolíticos.
- Reutilizar componentes y contratos existentes. Retirar código sin consumidores
  cuando se sustituya una implementación. No dejar versiones alternativas, código
  comentado ni capas de compatibilidad sin una necesidad funcional comprobada.
- Conservar las migraciones y la compatibilidad de los respaldos que protegen los
  datos reales. Una limpieza de código no debe borrar cuentas, pagos o archivos.
- El navegador usa cookie HttpOnly: no almacenar JWT ni claves en JavaScript,
  URLs, repositorio o logs. Mantener validación de campos propios, permisos por
  rol y propiedad, transacciones e idempotencia donde corresponda.
- Usar contenido real del club y sus equipaciones. Mantener responsive, foco de
  teclado y preferencias de animación/reducción de movimiento.
- Validar cambios con typecheck, pruebas pertinentes, build y smoke de producción.
  Para clasificación/persistencia, ejecutar los casos de SQLite y PostgreSQL. El
  despliegue sigue el flujo de GitHub Actions hacia Render.
- Hacer verificaciones destructivas y datos simulados en entornos aislados. No
  crear pagos, compras o correos reales como prueba de funcionamiento.

Referencia de arquitectura: `docs/CALIDAD-Y-ARQUITECTURA.md`.
