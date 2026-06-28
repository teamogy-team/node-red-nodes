# PostgreSQL node for Node-RED

Connect to PostgreSQL database.

You must configure Connection before using this node.

## Node Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Name | string | — | Optional display name |
| Connection | config | — | Select a postgres-config node |
| Debug mode | checkbox | off | If checked, emits a warning before each query showing the assembled SQL and dynamic parameters |

## Connection Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Name | string | Optional | Enter a name or it will be generated on first save |
| Server | string | Required | Enter the hostname or IP address |
| Port | number | Required | Port to connect to (default 5432) |
| TLS | checkbox | Optional | If checked, the connection will use TLS (`sslmode=require`) |
| Database | string | Required | Database name |
| User | string | Required | Username |
| Password | string | Required | User's password |
| Max. number of connections | number | Required | Value between 1 and 100, default 10 |
| Idle connection timeout (s) | number | Required | Value between 0 and 60, default 0 |
| Connection timeout (s) | number | Required | Value between 0 and 600, default 30 |

## Input Message

### Plain SQL (backward compatible)

Send any SQL string in `msg.payload`:

```js
msg.payload = "SELECT * FROM users WHERE id = 15"
```

Multiple commands separated by a semicolon:

```js
msg.payload = "SELECT * FROM users WHERE id = 15; SELECT * FROM groups WHERE group_name = 'accounting'"
```

### Dynamic SQL

Use placeholders in `msg.payload` together with `msg.sqlData`, `msg.sqlColumns`, and/or `msg.sqlColumnsUpdate` to build parameterized queries dynamically. Column names are automatically quoted to prevent SQL injection.

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | string | SQL with optional placeholders: `{columns}`, `{data}`, `{columnsUpdate}` |
| `msg.sqlData` | object \| object[] | Data for INSERT or UPDATE. An array triggers a bulk operation. |
| `msg.sqlColumns` | string[] | Column filter — selects which keys from `msg.sqlData` are used, or which columns to return in SELECT |
| `msg.sqlColumnsUpdate` | string[] | Columns to update in UPSERT conflict resolution; expands `{columnsUpdate}` to `"col" = EXCLUDED."col"` pairs |

#### Placeholders

| Placeholder | Expands to | Used for |
|-------------|-----------|---------|
| `{columns}` | `("col1", "col2")` in INSERT; stripped in UPDATE | Column list |
| `{data}` | `($1, $2), ($3, $4)` in INSERT; `"col"=$1, "col"=$2` in UPDATE | Values / SET pairs |
| `{columnsUpdate}` | `"col1" = EXCLUDED."col1", "col2" = EXCLUDED."col2"` | UPSERT ON CONFLICT SET clause |

---

### Examples

#### INSERT with explicit column list

```js
msg.payload    = "INSERT INTO users {columns} VALUES {data}"
msg.sqlData    = { name: "Alice", age: 30, role: "admin" }
msg.sqlColumns = ["name", "age"]   // only these columns are inserted
```
→ executes: `INSERT INTO users ("name", "age") VALUES ($1, $2)`

#### Bulk INSERT

```js
msg.payload    = "INSERT INTO users {columns} VALUES {data}"
msg.sqlData    = [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
msg.sqlColumns = ["name", "age"]
```
→ executes: `INSERT INTO users ("name", "age") VALUES ($1, $2), ($3, $4)`

#### UPDATE with column filter

`{columns}` is stripped from the SQL and acts only as a column filter directive for `{data}`.

```js
msg.payload          = "UPDATE users {columns} SET {data} WHERE id = 5"
msg.sqlData          = { name: "Alice", age: 30, role: "admin" }
msg.sqlColumns       = ["age"]   // only this column is updated
```
→ executes: `UPDATE users SET "age"=$1 WHERE id = 5`

#### UPSERT (INSERT … ON CONFLICT DO UPDATE)

```js
msg.payload          = "INSERT INTO users {columns} VALUES {data} ON CONFLICT (name) DO UPDATE SET {columnsUpdate}"
msg.sqlData          = { name: "Alice", age: 30, role: "admin" }
msg.sqlColumns       = ["name", "age"]   // columns to insert
msg.sqlColumnsUpdate = ["age"]           // columns to update on conflict
```
→ executes: `INSERT INTO users ("name", "age") VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET "age" = EXCLUDED."age"`

#### Dynamic SELECT columns

```js
msg.payload    = "SELECT {columns} FROM users WHERE active = true"
msg.sqlColumns = ["name", "age"]
```
→ returns only the specified columns; names are safely quoted

---

## Output Message

| Property | Type | Description |
|----------|------|-------------|
| `msg.payload` | array | Records returned by the server (empty array if no rows) |
| `msg.count` | number | Number of records (or arrays for multi-command queries) |
| `msg.error` | object | Error detail from the postgres client or server |

- Single command → `msg.payload` is an array of records, `msg.count` is the row count
- Multiple commands → `msg.payload` is an array of arrays, `msg.count` is the command count
- Command with no result (INSERT/UPDATE/DELETE) → `msg.payload` is `[]`, `msg.count` is `0`
- On error → `msg.error` contains `message`, `code`, `detail`, `hint`

## References

- [Teamogy Flow docs](https://teamogy.com/teamogy-flow) - full description of Teamogy Flow
- [PostgreSQL docs](https://www.postgresql.org/docs/) - full description of PostgreSQL
