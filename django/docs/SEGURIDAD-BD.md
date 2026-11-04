# Usuario de base de datos con privilegios mínimos

Objetivo: que la aplicación en producción se conecte a PostgreSQL con un usuario
que **solo pueda leer y escribir filas** (SELECT / INSERT / UPDATE / DELETE) y
**no pueda** borrar ni alterar tablas (DROP / ALTER), crear o borrar otras bases,
ni administrar usuarios. Así, si alguien lograra inyectar SQL o robar la cadena
de conexión del servicio web, el daño posible es mucho menor: no puede tumbar el
esquema ni escalar a administrador de la base.

## El detalle importante: las migraciones necesitan DDL

Django aplica migraciones con `python manage.py migrate`, y eso **sí** modifica
el esquema (crea y altera tablas). Lo mismo `createcachetable`. Por eso no basta
un único usuario sin DROP/ALTER: las migraciones dejarían de aplicarse.

La solución es **dos roles**:

| Rol | Para qué | Privilegios |
|-----|----------|-------------|
| `ferreteria_owner` | Solo en el **deploy**: `migrate`, `createcachetable`, `init_app` | Dueño del esquema (crea/altera tablas) |
| `ferreteria_app` | La app en marcha (gunicorn) día a día | Solo DML: SELECT/INSERT/UPDATE/DELETE + USAGE de secuencias |

El contenedor ya está preparado para esto: si definís la variable
`MIGRATION_DATABASE_URL`, `entrypoint.sh` corre los pasos de esquema con ese
usuario privilegiado y gunicorn sigue sirviendo con el usuario restringido de
`DATABASE_URL`. Si **no** la definís, todo usa `DATABASE_URL` como siempre.

---

## SQL para crear los dos roles

Ejecutá esto **una vez**, conectado como el usuario administrador que te dio tu
proveedor (en Render, el usuario dueño de la base que viene en la
`Internal Database URL`). Reemplazá las contraseñas por unas **fuertes**.

```sql
-- 1) Rol DUEÑO del esquema (solo se usa durante el deploy para migrar).
CREATE ROLE ferreteria_owner LOGIN PASSWORD 'CAMBIA_ESTA_owner';

-- 2) Rol de la APLICACIÓN (día a día): podrá iniciar sesión pero NO es dueño
--    de nada y NO puede crear/alterar/borrar tablas.
CREATE ROLE ferreteria_app LOGIN PASSWORD 'CAMBIA_ESTA_app';

-- Ninguno de los dos debe ser superusuario ni poder crear bases/roles.
ALTER ROLE ferreteria_owner NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE ferreteria_app   NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 3) Que el esquema public pertenezca al owner (las tablas que cree migrate
--    serán suyas). Ajustá 'ferreteria' si tu base se llama distinto.
ALTER SCHEMA public OWNER TO ferreteria_owner;

-- 4) El usuario de la app puede USAR el esquema, pero no crear objetos en él.
GRANT USAGE ON SCHEMA public TO ferreteria_app;
REVOKE CREATE ON SCHEMA public FROM ferreteria_app;
-- (En PostgreSQL 15+ el rol público ya no tiene CREATE en public; si tu versión
--  es anterior, este REVOKE lo asegura.)
```

### Permisos sobre las tablas (DML) para el usuario de la app

Las tablas todavía no existen hasta el **primer** `migrate`. Hay dos formas:

**A. Automática y a prueba de futuro (recomendada).** Hacé que todo lo que cree
el owner de ahora en adelante quede, por defecto, accesible para la app. Ejecutá
esto **como `ferreteria_owner`** (porque `ALTER DEFAULT PRIVILEGES` aplica a los
objetos que crea el rol que lo ejecuta):

```sql
-- Conectado como ferreteria_owner:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ferreteria_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ferreteria_app;
```

Con esto, cada migración futura que cree tablas nuevas le concede sola los
permisos de fila a la app. **No** se incluye `TRUNCATE` ni DDL, así que la app
sigue sin poder vaciar ni alterar tablas.

**B. Para las tablas que ya existen** (corré esto después de cada migración que
agregue tablas, o una vez tras el primer deploy, como owner o admin):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ferreteria_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ferreteria_app;
```

> Hacé **A** siempre; **B** solo si ya habías migrado antes de aplicar A.

---

## Orden recomendado de pasos

1. Creá la base con tu proveedor (Render la crea con el blueprint).
2. Conectado como el admin de la base, corré el **SQL de los dos roles** (arriba).
3. Conectado como `ferreteria_owner`, corré el bloque **A** (default privileges).
4. En el servicio web, configurá las dos variables de entorno (abajo).
5. Hacé deploy. `entrypoint.sh` migrará con el owner y servirá con la app.

---

## Variables de entorno en Render (o donde corras el contenedor)

Tu proveedor te da una URL de conexión; de ahí salen el host, el puerto y el
nombre de la base. Construí dos URLs cambiando solo **usuario:contraseña**:

```
# La app en marcha → usuario restringido (sin DROP/ALTER):
DATABASE_URL=postgres://ferreteria_app:CAMBIA_ESTA_app@HOST:5432/ferreteria

# Solo para migrar en el deploy → usuario dueño del esquema:
MIGRATION_DATABASE_URL=postgres://ferreteria_owner:CAMBIA_ESTA_owner@HOST:5432/ferreteria
```

En Render: servicio web → **Environment** → agregá/editá esas dos claves.
`HOST` y el nombre de la base son los mismos que ya traía tu `DATABASE_URL`
original; solo cambia el usuario y la contraseña al inicio.

> **Importante:** `MIGRATION_DATABASE_URL` la usa únicamente el arranque para
> migrar; gunicorn **nunca** la usa. El usuario `ferreteria_app` es el que queda
> expuesto en el proceso web, y es el que no puede hacer daño estructural.

### ¿Y si quiero seguir con un solo usuario?

No pasa nada: si no definís `MIGRATION_DATABASE_URL`, el arranque usa
`DATABASE_URL` para todo, igual que antes. En ese caso, para no correr como
superusuario, al menos usá un rol `NOSUPERUSER NOCREATEDB NOCREATEROLE` que sea
**dueño solo de su propia base** (no del clúster). Pierde la protección contra
DROP/ALTER de sus propias tablas, pero evita lo peor: tocar otras bases o
escalar a administrador.

---

## Cómo verificarlo

Conectado como `ferreteria_app`, estas dos deben comportarse así:

```sql
-- Debe FUNCIONAR (la app lee y escribe filas):
SELECT COUNT(*) FROM auth_user;

-- Debe FALLAR con "permission denied" (la app no altera el esquema):
DROP TABLE auth_user;
ALTER TABLE auth_user ADD COLUMN x int;
```

Si el `SELECT` funciona y el `DROP`/`ALTER` dan *permission denied*, el usuario
de producción quedó con privilegios mínimos. 

---

## Nota sobre respaldos

El respaldo automático (ver módulo *Respaldos*) hace `pg_dump`, que solo **lee**
datos: puede correr con el usuario `ferreteria_app` (restringido) sin problema.
No necesita privilegios de administrador.
